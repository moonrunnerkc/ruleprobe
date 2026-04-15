/**
 * Fast-path resolver for threshold-based similarity decisions.
 *
 * When similarity is above the fast-path threshold, returns
 * a verdict directly without LLM escalation. When below,
 * signals escalation is needed.
 */

import type { FeatureVector, SemanticVerdict, StructuralViolation } from '../../types.js';
import { combinedSimilarity } from './vector-similarity.js';

/**
 * Pre-calibration default for the fast-path threshold.
 * Above this value, structural resolution is considered reliable.
 * Below, the rule is escalated to LLM judgment.
 *
 * Source: ASPE architecture spec. Will be calibrated on excalidraw
 * and PostHog fixtures in Phase 4.
 */
export const PRE_CALIBRATION_THRESHOLD = 0.85;

/** Result from a fast-path resolution attempt. */
export interface FastPathResult {
  /** Whether fast-path resolved the comparison */
  resolved: boolean;
  /** The compliance score (only meaningful if resolved) */
  compliance: number;
  /** The raw similarity score */
  similarity: number;
}

/**
 * Attempt fast-path resolution of a rule via vector similarity.
 *
 * If the combined similarity score meets or exceeds the threshold,
 * the rule is resolved with a direct compliance score. Otherwise,
 * signals that LLM escalation is needed.
 *
 * @param profileVector - Feature vector from the codebase profile
 * @param targetVector - Feature vector from the target/rule context
 * @param threshold - Fast-path threshold (defaults to PRE_CALIBRATION_THRESHOLD)
 * @returns Fast-path result with resolution status and scores
 */
export function attemptFastPath(
  profileVector: FeatureVector,
  targetVector: FeatureVector,
  threshold: number = PRE_CALIBRATION_THRESHOLD,
): FastPathResult {
  const similarity = combinedSimilarity(profileVector, targetVector);

  if (similarity >= threshold) {
    return {
      resolved: true,
      compliance: similarity,
      similarity,
    };
  }

  return {
    resolved: false,
    compliance: similarity,
    similarity,
  };
}

/**
 * Build a SemanticVerdict for a fast-path resolution.
 *
 * @param ruleId - The rule being verified
 * @param compliance - The compliance score from fast-path
 * @param profileHash - The profile hash for tracing
 * @returns A complete SemanticVerdict
 */
export function buildFastPathVerdict(
  ruleId: string,
  compliance: number,
  profileHash: string,
): SemanticVerdict {
  return {
    ruleId,
    compliance,
    method: 'structural-fast-path',
    violations: [],
    mitigations: [],
    profileHash,
    tokenCost: 0,
  };
}
