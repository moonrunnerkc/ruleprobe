/**
 * Per-rule resolution logic, separated from the main orchestrator
 * to respect the 300-line file limit.
 *
 * Handles fast-path, LLM escalation, and qualifier resolution
 * for a single rule.
 */

import type {
  StructuralProfile,
  RawExtractionPayload,
  SemanticVerdict,
  FeatureVector,
  RawFileVector,
  ExtractedRulePayload,
  CrossFileFinding,
  LlmCaller,
} from '../types.js';
import { TopicRegistry } from './fingerprint/topic-registry.js';
import type { TopicDefinition } from './fingerprint/topic-registry.js';
import { harvestExamples } from './fingerprint/example-harvester.js';
import { attemptFastPath, buildFastPathVerdict } from './comparison/fast-path-resolver.js';
import { combinedSimilarity } from './comparison/vector-similarity.js';
import {
  checkConsistency,
  applyAdjustment,
} from './comparison/cross-file-checker.js';
import { resolveLlmEscalation, resolveQualifiedRule } from './llm-escalation.js';
import { evaluateComposites } from './fingerprint/composite-patterns.js';
import { deriveRuntimeTopic } from './fingerprint/runtime-topic-extension.js';

/** Result of resolving a single rule. */
export interface RuleResolutionResult {
  verdict: SemanticVerdict;
  llmCallsUsed: number;
}

/**
 * Maximum LLM retries for response validation.
 * On second failure, returns inconclusive.
 */
const MAX_LLM_RETRIES = 1;

/**
 * Compliance assigned to rules with no matching topic in the profile.
 * Set to -1 to indicate the rule cannot be structurally verified.
 * Downstream consumers must exclude these from aggregated scores.
 */
const NOT_VERIFIABLE_COMPLIANCE = -1;

/**
 * Resolve a single rule against the structural profile.
 *
 * @param rule - The extracted rule
 * @param profile - The structural profile
 * @param payload - Raw extraction payload
 * @param crossFileFindings - Cross-file consistency data
 * @param threshold - Fast-path threshold
 * @param llmCaller - LLM callback
 * @param currentLlmCalls - LLM calls consumed so far
 * @param maxLlmCalls - Maximum LLM calls allowed
 * @returns Resolution result with verdict and LLM call count
 */
export async function resolveRule(
  rule: ExtractedRulePayload,
  profile: StructuralProfile,
  payload: RawExtractionPayload,
  crossFileFindings: CrossFileFinding[],
  threshold: number,
  llmCaller: LlmCaller,
  currentLlmCalls: number,
  maxLlmCalls: number,
): Promise<RuleResolutionResult> {
  const registry = new TopicRegistry();
  let matchedTopics = registry.findTopics(rule.ruleText);

  if (matchedTopics.length === 0) {
    const runtimeTopic = deriveRuntimeTopic(
      rule.ruleText,
      rule.ruleId,
      payload.fileVectors,
    );
    if (runtimeTopic) {
      registry.registerRuntimeTopic(runtimeTopic);
      matchedTopics.push(runtimeTopic);
    } else {
      return noTopicResult(rule, profile.profileId);
    }
  }

  const topicName = matchedTopics[0]?.topic ?? '';

  if (isNonProfilableTopic(matchedTopics[0])) {
    return topicMatchedNoProfileResult(rule, topicName, profile.profileId);
  }

  const profileVector = profile.featureVectors.get(topicName);

  if (!profileVector) {
    return noTopicResult(rule, profile.profileId);
  }

  const targetVector = buildTargetVector(payload, topicName);

  const fastPath = attemptFastPath(profileVector, targetVector, threshold);

  if (fastPath.resolved) {
    const compliance = applyCrossFileAdjustment(
      fastPath.compliance,
      profile,
      payload,
      topicName,
    );
    const verdict = buildFastPathVerdict(rule.ruleId, compliance, profile.profileId);
    return { verdict, llmCallsUsed: 0 };
  }

  if (isQualifiedRule(rule.qualifier)) {
    return resolveQualifiedRule(
      rule,
      profileVector,
      targetVector,
      profile,
      payload,
      llmCaller,
      currentLlmCalls,
      maxLlmCalls,
    );
  }

  return resolveLlmEscalation(
    rule,
    topicName,
    profileVector,
    targetVector,
    fastPath.similarity,
    threshold,
    profile,
    payload,
    llmCaller,
    currentLlmCalls,
    maxLlmCalls,
  );
}

/**
 * Build a target vector from topic-relevant files for comparison.
 *
 * Uses the same file selection as the fingerprint generator (via
 * harvestExamples) to build a representative vector from files
 * relevant to the topic. This ensures fair comparison: the target
 * vector and the profile vector originate from the same file
 * population, so similarity reflects structural consistency within
 * that topic rather than topic coverage of the codebase.
 *
 * When no topic is provided, falls back to all files (backward compat).
 */
export function buildTargetVector(
  payload: RawExtractionPayload,
  topicName: string,
): FeatureVector {
  const registry = new TopicRegistry();
  const topicDef = registry.getTopic(topicName);

  let fileEntries: Array<[string, RawFileVector]>;

  if (topicDef) {
    const examples = harvestExamples(topicDef, payload.fileVectors);
    fileEntries = examples.map(e => [e.fileId, e.vector]);
  } else {
    fileEntries = Object.entries(payload.fileVectors);
  }

  if (fileEntries.length === 0) {
    fileEntries = Object.entries(payload.fileVectors);
  }

  const allCounts: Record<string, number> = {};
  const allDepths: Record<string, number> = {};
  const allSigs = new Set<string>();
  const compositeAccum: Record<string, number> = {};
  const fileCount = fileEntries.length || 1;

  for (const [, v] of fileEntries) {
    for (const [k, c] of Object.entries(v.nodeTypeCounts)) {
      allCounts[k] = (allCounts[k] ?? 0) + c;
    }
    for (const [k, d] of Object.entries(v.nestingDepths)) {
      allDepths[k] = (allDepths[k] ?? 0) + d;
    }
    for (const s of v.subTreeHashes) {
      allSigs.add(s);
    }
    const compositeResults = evaluateComposites(topicName, v);
    for (const cr of compositeResults) {
      compositeAccum[cr.compositeId] = (compositeAccum[cr.compositeId] ?? 0) + cr.value;
    }
  }

  for (const k of Object.keys(allCounts)) {
    allCounts[k] = (allCounts[k] ?? 0) / fileCount;
  }
  for (const k of Object.keys(allDepths)) {
    allDepths[k] = (allDepths[k] ?? 0) / fileCount;
  }
  const normalizedComposites: Record<string, number> = {};
  for (const [k, v] of Object.entries(compositeAccum)) {
    normalizedComposites[k] = v / fileCount;
  }

  return {
    nodeTypeCounts: allCounts,
    nestingDepths: allDepths,
    patternSignatures: Array.from(allSigs),
    prevalence: 1.0,
    compositePatterns: normalizedComposites,
  };
}

/** Check if a qualifier needs Layer 3 resolution. */
function isQualifiedRule(qualifier: string): boolean {
  return qualifier === 'when-possible'
    || qualifier === 'avoid-unless'
    || qualifier === 'try-to';
}

/** Build a not-verifiable result for rules without matching profile topics. */
function noTopicResult(
  rule: ExtractedRulePayload,
  profileHash: string,
): RuleResolutionResult {
  return {
    verdict: {
      ruleId: rule.ruleId,
      compliance: NOT_VERIFIABLE_COMPLIANCE,
      method: 'not-verifiable',
      reasoning: 'No matching topic in structural profile; rule cannot be verified semantically',
      violations: [],
      mitigations: [],
      profileHash,
      tokenCost: 0,
    },
    llmCallsUsed: 0,
  };
}

/** Apply cross-file consistency adjustment. */
function applyCrossFileAdjustment(
  compliance: number,
  profile: StructuralProfile,
  payload: RawExtractionPayload,
  topicName: string,
): number {
  const fileIds = Object.keys(payload.fileVectors);
  if (fileIds.length === 0) return compliance;
  const firstFileId = fileIds[0] ?? '';
  const result = checkConsistency(profile.crossFileGraph, firstFileId, topicName);
  return applyAdjustment(compliance, result.adjustment);
}

/**
 * Compliance for topic-matched-no-profile rules.
 * Same as not-verifiable (-1); downstream excludes from averages.
 */
const TOPIC_MATCHED_NO_PROFILE_COMPLIANCE = -1;

/** Check if a topic has no AST features (non-profilable, e.g. workflow). */
function isNonProfilableTopic(topic: TopicDefinition | undefined): boolean {
  if (!topic) return false;
  return topic.nodeTypes.length === 0 && topic.features.length === 0;
}

/** Build a topic-matched-no-profile result for non-profilable topics. */
function topicMatchedNoProfileResult(
  rule: ExtractedRulePayload,
  topicName: string,
  profileHash: string,
): RuleResolutionResult {
  return {
    verdict: {
      ruleId: rule.ruleId,
      compliance: TOPIC_MATCHED_NO_PROFILE_COMPLIANCE,
      method: 'topic-matched-no-profile',
      reasoning: `Topic "${topicName}" matched but has no AST features; cannot be verified structurally`,
      violations: [],
      mitigations: [],
      profileHash,
      tokenCost: 0,
    },
    llmCallsUsed: 0,
  };
}
