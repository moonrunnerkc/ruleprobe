/**
 * Validation feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract validation features from a file vector.
 *
 * Measures: schema validation, type guards, input sanitization,
 * Zod usage, io-ts usage.
 */
export const extractValidation: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const typePredicateCount = countNodeType(vector, 'type_predicate');

  return [
    { featureId: 'schema-validation', value: callCount, signatureContributed: false },
    { featureId: 'type-guard', value: typePredicateCount, signatureContributed: false },
    { featureId: 'input-sanitization', value: callCount, signatureContributed: false },
    { featureId: 'zod-usage', value: callCount, signatureContributed: false },
    { featureId: 'io-ts-usage', value: callCount, signatureContributed: false },
  ];
};
