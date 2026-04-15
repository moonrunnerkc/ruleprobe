/**
 * Common types and utilities for structural feature extraction.
 *
 * Each topic-specific feature extractor works on RawFileVector data
 * (node type counts, nesting depths, sub-tree hashes) to produce
 * feature measurements without accessing raw source code.
 */

import type { RawFileVector } from '../../../types.js';

/** Result of extracting a single feature from a file vector. */
export interface FeatureExtraction {
  /** Feature identifier matching FeatureDefinition.featureId */
  featureId: string;
  /** Numeric measurement (count, depth, or 1/0 for signature presence) */
  value: number;
  /** Whether a signature hash was contributed */
  signatureContributed: boolean;
}

/** Extracts features from a single raw file vector for a topic. */
export type FeatureExtractor = (
  vector: RawFileVector,
) => FeatureExtraction[];

/**
 * Count a specific AST node type from a file vector.
 *
 * @param vector - The raw file vector
 * @param nodeType - The AST node type to count
 * @returns The count, or 0 if absent
 */
export function countNodeType(
  vector: RawFileVector,
  nodeType: string,
): number {
  return vector.nodeTypeCounts[nodeType] ?? 0;
}

/**
 * Get a nesting depth measurement from a file vector.
 *
 * @param vector - The raw file vector
 * @param depthKey - The nesting depth key
 * @returns The depth value, or 0 if absent
 */
export function getDepth(
  vector: RawFileVector,
  depthKey: string,
): number {
  return vector.nestingDepths[depthKey] ?? 0;
}

/**
 * Check if any sub-tree hash from a candidate set is present in the vector.
 *
 * @param vector - The raw file vector
 * @param candidateHashes - Set of hashes to check against
 * @returns True if any hash matches
 */
export function hasSignatureMatch(
  vector: RawFileVector,
  candidateHashes: ReadonlySet<string>,
): boolean {
  return vector.subTreeHashes.some((h) => candidateHashes.has(h));
}
