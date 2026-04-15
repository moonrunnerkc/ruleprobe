/**
 * Hashing utilities for fingerprint generation.
 *
 * Deterministic hash functions used to produce opaque
 * signatures for feature contributions and file-topic patterns.
 */

import { createHash } from 'node:crypto';
import type { RawFileVector } from '../../types.js';

/**
 * Compute a deterministic signature hash for a feature contribution.
 *
 * @param topic - Topic identifier
 * @param featureId - Feature identifier
 * @param fileId - Opaque file identifier
 * @returns SHA-256 hash of the combined inputs
 */
export function computeFeatureSignature(
  topic: string,
  featureId: string,
  fileId: string,
): string {
  return createHash('sha256')
    .update(`${topic}:${featureId}:${fileId}`)
    .digest('hex');
}

/**
 * Compute a deterministic signature for a file's pattern within a topic.
 *
 * Based on which of the topic's node types are present and at what
 * relative proportions. Files with the same structural approach to
 * a topic produce the same signature.
 *
 * @param topic - Topic identifier
 * @param vector - The file's raw vector
 * @returns SHA-256 hash representing the file's approach to this topic
 */
export function computeFileTopicSignature(
  topic: string,
  vector: RawFileVector,
): string {
  const parts: string[] = [topic];
  const sortedKeys = Object.keys(vector.nodeTypeCounts).sort();

  for (const key of sortedKeys) {
    const count = vector.nodeTypeCounts[key] ?? 0;
    if (count > 0) {
      /** Bucket counts into ranges to group similar files */
      const bucket = count <= 5 ? 'low' : count <= 20 ? 'mid' : 'high';
      parts.push(`${key}:${bucket}`);
    }
  }

  return createHash('sha256').update(parts.join('|')).digest('hex');
}
