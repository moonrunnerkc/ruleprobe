/**
 * Fingerprint generator: the core ASPE profiling engine.
 *
 * Takes raw vectors from RawExtractionPayload, classifies files into
 * topics, builds StructuralProfile with FeatureVector per topic and
 * CrossFileGraph for consistency analysis.
 */

import { createHash } from 'node:crypto';
import type {
  RawExtractionPayload,
  RawFileVector,
  StructuralProfile,
  FeatureVector,
  CrossFileGraph,
  PatternTopic,
  ExtractedRulePayload,
} from '../../types.js';
import { TopicRegistry } from './topic-registry.js';
import type { TopicDefinition } from './topic-registry.js';
import { TOPIC_EXTRACTORS } from './structural-features/index.js';
import type { FeatureExtraction } from './structural-features/index.js';
import { harvestExamples } from './example-harvester.js';
import { computeFeatureSignature, computeFileTopicSignature } from './hash-utils.js';
import { evaluateComposites } from './composite-patterns.js';

/**
 * Minimum number of files containing a topic before prevalence
 * is considered meaningful.
 *
 * Prevents profiling noise from topics with too few examples.
 */
const MIN_TOPIC_SAMPLE = 3;

/**
 * Generate a StructuralProfile from a raw extraction payload.
 *
 * This is the core profiling step:
 * 1. Determine which topics are relevant (from rule text)
 * 2. Harvest example files for each topic
 * 3. Extract per-topic feature vectors
 * 4. Build cross-file graph for consistency analysis
 *
 * @param payload - The raw extraction payload from the client
 * @returns A complete StructuralProfile
 */
export function generateFingerprint(
  payload: RawExtractionPayload,
): StructuralProfile {
  const registry = new TopicRegistry();
  const relevantTopics = resolveRelevantTopics(registry, payload.rules);
  const featureVectors = new Map<PatternTopic, FeatureVector>();
  const sampleSize = Object.keys(payload.fileVectors).length;

  for (const topic of relevantTopics) {
    const examples = harvestExamples(topic, payload.fileVectors);
    if (examples.length < MIN_TOPIC_SAMPLE) {
      continue;
    }

    const vector = buildFeatureVector(topic, examples, sampleSize);
    featureVectors.set(topic.topic, vector);
  }

  const crossFileGraph = buildCrossFileGraph(
    relevantTopics,
    payload.fileVectors,
  );

  return {
    profileId: payload.extractionHash,
    generatedAt: new Date().toISOString(),
    featureVectors,
    crossFileGraph,
    sampleSize,
  };
}

/**
 * Resolve which topics are relevant for this analysis run.
 *
 * Matches rule text against the topic registry. Each rule may
 * match zero or more topics. Deduplicated by topic id.
 *
 * @param registry - The topic registry to search
 * @param rules - The extracted rules to match
 * @returns Deduplicated array of relevant topic definitions
 */
export function resolveRelevantTopics(
  registry: TopicRegistry,
  rules: ExtractedRulePayload[],
): TopicDefinition[] {
  const seen = new Set<string>();
  const result: TopicDefinition[] = [];

  for (const rule of rules) {
    const matches = registry.findTopics(rule.ruleText);
    for (const match of matches) {
      if (!seen.has(match.topic)) {
        seen.add(match.topic);
        result.push(match);
      }
    }
  }

  return result;
}

/**
 * Build a FeatureVector for a topic from harvested examples.
 *
 * Aggregates node type counts, nesting depths, and pattern signatures
 * across all example files. Normalizes counts per file.
 *
 * @param topic - The topic definition
 * @param examples - Harvested example files
 * @param totalFiles - Total files in the codebase
 * @returns Aggregated feature vector
 */
export function buildFeatureVector(
  topic: TopicDefinition,
  examples: Array<{ fileId: string; vector: RawFileVector; relevanceScore: number }>,
  totalFiles: number,
): FeatureVector {
  const extractor = TOPIC_EXTRACTORS.get(topic.topic);
  const aggregatedCounts: Record<string, number> = {};
  const aggregatedDepths: Record<string, number> = {};
  const signatureSet = new Set<string>();
  const compositeAccum: Record<string, number> = {};
  const fileCount = examples.length;

  for (const example of examples) {
    aggregateNodeCounts(example.vector, aggregatedCounts);
    aggregateNestingDepths(example.vector, aggregatedDepths);

    for (const hash of example.vector.subTreeHashes) {
      signatureSet.add(hash);
    }

    if (extractor) {
      const features = extractor(example.vector);
      for (const f of features) {
        if (f.signatureContributed) {
          const sigHash = computeFeatureSignature(
            topic.topic,
            f.featureId,
            example.fileId,
          );
          signatureSet.add(sigHash);
        }
      }
    }

    const compositeResults = evaluateComposites(topic.topic, example.vector);
    for (const cr of compositeResults) {
      compositeAccum[cr.compositeId] = (compositeAccum[cr.compositeId] ?? 0) + cr.value;
    }
  }

  const normalizedCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(aggregatedCounts)) {
    normalizedCounts[key] = fileCount > 0 ? value / fileCount : 0;
  }

  const averagedDepths: Record<string, number> = {};
  for (const [key, value] of Object.entries(aggregatedDepths)) {
    averagedDepths[key] = fileCount > 0 ? value / fileCount : 0;
  }

  const normalizedComposites: Record<string, number> = {};
  for (const [key, value] of Object.entries(compositeAccum)) {
    normalizedComposites[key] = fileCount > 0 ? value / fileCount : 0;
  }

  const prevalence = totalFiles > 0 ? fileCount / totalFiles : 0;

  return {
    nodeTypeCounts: normalizedCounts,
    nestingDepths: averagedDepths,
    patternSignatures: Array.from(signatureSet),
    prevalence,
    compositePatterns: normalizedComposites,
  };
}

/**
 * Build a CrossFileGraph for consistency analysis.
 *
 * Groups files by their dominant pattern signatures per topic,
 * creating edges between files that share patterns.
 *
 * @param topics - Relevant topics to analyze
 * @param fileVectors - All raw file vectors
 * @returns The cross-file graph
 */
export function buildCrossFileGraph(
  topics: TopicDefinition[],
  fileVectors: Record<string, RawFileVector>,
): CrossFileGraph {
  const edges = new Map<string, Map<string, string[]>>();
  const entries = Object.entries(fileVectors);

  for (const topic of topics) {
    const extractor = TOPIC_EXTRACTORS.get(topic.topic);
    if (!extractor) {
      continue;
    }

    const signatureToFiles = new Map<string, string[]>();

    for (const [fileId, vector] of entries) {
      const hasRelevantNodes = topic.nodeTypes.some(
        (nt) => (vector.nodeTypeCounts[nt] ?? 0) > 0,
      );
      if (!hasRelevantNodes) {
        continue;
      }

      const signature = computeFileTopicSignature(topic.topic, vector);
      const existing = signatureToFiles.get(signature) ?? [];
      existing.push(fileId);
      signatureToFiles.set(signature, existing);
    }

    for (const [fileId, vector] of entries) {
      const signature = computeFileTopicSignature(topic.topic, vector);
      const peers = signatureToFiles.get(signature) ?? [];
      const filteredPeers = peers.filter((p) => p !== fileId);

      if (filteredPeers.length > 0) {
        const fileEdges = edges.get(fileId) ?? new Map<string, string[]>();
        fileEdges.set(signature, filteredPeers);
        edges.set(fileId, fileEdges);
      }
    }
  }

  return { edges };
}

/**
 * Aggregate node type counts from a file vector into a running total.
 *
 * @param vector - Source file vector
 * @param target - Aggregation target
 */
function aggregateNodeCounts(
  vector: RawFileVector,
  target: Record<string, number>,
): void {
  for (const [key, value] of Object.entries(vector.nodeTypeCounts)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

/**
 * Aggregate nesting depths from a file vector into a running total.
 *
 * @param vector - Source file vector
 * @param target - Aggregation target
 */
function aggregateNestingDepths(
  vector: RawFileVector,
  target: Record<string, number>,
): void {
  for (const [key, value] of Object.entries(vector.nestingDepths)) {
    target[key] = (target[key] ?? 0) + value;
  }
}


