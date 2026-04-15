/**
 * Vector similarity scoring for structural comparison.
 *
 * Implements weighted Jaccard on nodeTypeCounts and compositePatterns,
 * and cosine similarity on patternSignatures. The three-component
 * combined score drives fast-path vs LLM escalation decisions.
 */

import type { FeatureVector } from '../../types.js';

/**
 * Weight for node-type Jaccard similarity in the combined score.
 *
 * Source: ASPE architecture spec. Reduced from 0.4 to 0.25 to make
 * room for composite Jaccard, which captures multi-node conjunctions.
 */
export const JACCARD_WEIGHT = 0.25;

/**
 * Weight for composite-pattern Jaccard similarity in the combined score.
 *
 * Composites capture multi-node conjunctions (e.g. try-catch-with-logging)
 * that individual node counts miss. Higher weight reflects their stronger
 * discriminative power for structural pattern matching.
 *
 * Source: ASPE architecture spec; value pending calibration on fixtures.
 */
export const COMPOSITE_JACCARD_WEIGHT = 0.35;

/**
 * Weight for cosine similarity in the combined score.
 *
 * Source: ASPE architecture spec. Reduced from 0.6 to 0.4 to make
 * room for composite Jaccard.
 */
export const COSINE_WEIGHT = 0.4;

/**
 * Compute weighted Jaccard similarity on node type counts.
 *
 * Intersection: sum of min(a[key], b[key]) for shared keys
 * Union: sum of max(a[key], b[key]) for all keys
 * Jaccard = intersection / union
 *
 * @param profileCounts - Node type counts from codebase profile
 * @param targetCounts - Node type counts from target file/rule
 * @returns Jaccard similarity score (0-1)
 */
export function weightedJaccard(
  profileCounts: Record<string, number>,
  targetCounts: Record<string, number>,
): number {
  const allKeys = new Set<string>([
    ...Object.keys(profileCounts),
    ...Object.keys(targetCounts),
  ]);

  if (allKeys.size === 0) {
    return 1.0;
  }

  let intersection = 0;
  let union = 0;

  for (const key of allKeys) {
    const a = profileCounts[key] ?? 0;
    const b = targetCounts[key] ?? 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }

  if (union === 0) {
    return 1.0;
  }

  return intersection / union;
}

/**
 * Compute cosine similarity on pattern signatures.
 *
 * Treats signatures as binary vectors (present=1, absent=0).
 * Cosine = dot product / (magnitude_a * magnitude_b)
 *
 * @param profileSignatures - Pattern signatures from codebase profile
 * @param targetSignatures - Pattern signatures from target
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(
  profileSignatures: string[],
  targetSignatures: string[],
): number {
  if (profileSignatures.length === 0 && targetSignatures.length === 0) {
    return 1.0;
  }

  if (profileSignatures.length === 0 || targetSignatures.length === 0) {
    return 0.0;
  }

  const profileSet = new Set(profileSignatures);
  const targetSet = new Set(targetSignatures);

  let dotProduct = 0;
  for (const sig of targetSet) {
    if (profileSet.has(sig)) {
      dotProduct += 1;
    }
  }

  const magnitudeA = Math.sqrt(profileSet.size);
  const magnitudeB = Math.sqrt(targetSet.size);
  const denominator = magnitudeA * magnitudeB;

  if (denominator === 0) {
    return 0.0;
  }

  return dotProduct / denominator;
}

/**
 * Compute the combined similarity score from three components:
 * node-type Jaccard, composite-pattern Jaccard, and cosine.
 *
 * Combined = (jaccardWeight * nodeJaccard)
 *          + (compositeWeight * compositeJaccard)
 *          + (cosineWeight * cosine)
 *
 * When compositePatterns are empty on both sides, the composite
 * Jaccard evaluates to 1.0 (identical empty sets), which is the
 * correct neutral behavior for topics without composites.
 *
 * @param profileVector - Feature vector from codebase profile
 * @param targetVector - Feature vector from target
 * @param jaccardWeight - Weight for node Jaccard (defaults to JACCARD_WEIGHT)
 * @param cosineWeight - Weight for cosine component (defaults to COSINE_WEIGHT)
 * @param compositeWeight - Weight for composite Jaccard (defaults to COMPOSITE_JACCARD_WEIGHT)
 * @returns Combined similarity score (0-1)
 */
export function combinedSimilarity(
  profileVector: FeatureVector,
  targetVector: FeatureVector,
  jaccardWeight: number = JACCARD_WEIGHT,
  cosineWeight: number = COSINE_WEIGHT,
  compositeWeight: number = COMPOSITE_JACCARD_WEIGHT,
): number {
  const jaccard = weightedJaccard(
    profileVector.nodeTypeCounts,
    targetVector.nodeTypeCounts,
  );

  const compositeJaccard = weightedJaccard(
    profileVector.compositePatterns ?? {},
    targetVector.compositePatterns ?? {},
  );

  const cosine = cosineSimilarity(
    profileVector.patternSignatures,
    targetVector.patternSignatures,
  );

  return jaccardWeight * jaccard + compositeWeight * compositeJaccard + cosineWeight * cosine;
}
