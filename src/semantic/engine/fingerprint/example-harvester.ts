/**
 * Example harvester for collecting representative AST vectors per topic.
 *
 * Walks all file vectors and extracts the ones most relevant to each
 * detected topic, producing a curated set of examples for the
 * fingerprint generator.
 */

import type { RawFileVector, PatternTopic } from '../../types.js';
import type { TopicDefinition } from './topic-registry.js';

/** A harvested example: a file vector with its relevance score for a topic. */
export interface HarvestedExample {
  /** Opaque file identifier */
  fileId: string;
  /** The raw vector data */
  vector: RawFileVector;
  /** How relevant this file is to the topic (0-1) */
  relevanceScore: number;
}

/**
 * Minimum relevance score for a file to be considered an example.
 * Files below this threshold are not included as topic examples.
 * Set conservatively low to capture diverse patterns.
 */
const MIN_RELEVANCE_SCORE = 0.1;

/**
 * Maximum number of example files to keep per topic.
 * Limits memory usage while preserving pattern diversity.
 */
const MAX_EXAMPLES_PER_TOPIC = 100;

/**
 * Harvest example files for a topic from the raw file vectors.
 *
 * Scores each file by how many of the topic's relevant AST node
 * types are present, then returns the top-scoring files.
 *
 * @param topic - The topic definition to harvest for
 * @param fileVectors - All raw file vectors keyed by opaque identifier
 * @returns Harvested examples sorted by relevance (highest first)
 */
export function harvestExamples(
  topic: TopicDefinition,
  fileVectors: Record<string, RawFileVector>,
): HarvestedExample[] {
  const examples: HarvestedExample[] = [];
  const entries = Object.entries(fileVectors);

  for (const [fileId, vector] of entries) {
    const relevance = computeRelevance(topic, vector);
    if (relevance >= MIN_RELEVANCE_SCORE) {
      examples.push({ fileId, vector, relevanceScore: relevance });
    }
  }

  examples.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return examples.slice(0, MAX_EXAMPLES_PER_TOPIC);
}

/**
 * Compute how relevant a file vector is to a topic.
 *
 * Measures the fraction of the topic's node types that appear
 * in the file, weighted by count. Returns 0-1.
 *
 * @param topic - The topic definition
 * @param vector - The raw file vector
 * @returns Relevance score from 0 to 1
 */
export function computeRelevance(
  topic: TopicDefinition,
  vector: RawFileVector,
): number {
  if (topic.nodeTypes.length === 0) {
    return 0;
  }

  let matchedTypes = 0;
  let totalWeight = 0;

  for (const nodeType of topic.nodeTypes) {
    const count = vector.nodeTypeCounts[nodeType] ?? 0;
    if (count > 0) {
      matchedTypes += 1;
      totalWeight += Math.min(count, 10);
    }
  }

  const typeCoverage = matchedTypes / topic.nodeTypes.length;
  const weightFactor = totalWeight > 0 ? Math.min(totalWeight / 10, 1) : 0;

  return typeCoverage * 0.6 + weightFactor * 0.4;
}
