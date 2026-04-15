/**
 * Workflow topic: non-profilable placeholder extractor.
 *
 * The workflow topic covers commit messages, PR conventions, and
 * agent behavior directives. These have no AST representation.
 * This no-op extractor exists solely to satisfy the registry
 * invariant that every topic has an extractor entry.
 *
 * Source: 122 WORKFLOW statements in corpus + 10 not-verifiable rules.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';

/**
 * No-op extractor for the workflow topic.
 *
 * Returns an empty array because workflow rules (commit messages,
 * PR conventions, agent behavior) have no AST features.
 */
export const extractWorkflow: FeatureExtractor = (
  _vector: RawFileVector,
): FeatureExtraction[] => {
  return [];
};
