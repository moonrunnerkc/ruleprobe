/**
 * API patterns feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract API pattern features from a file vector.
 *
 * Measures: REST route structure, middleware chains, controller
 * patterns, DTO validation, response shapes.
 */
export const extractApiPatterns: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const classCount = countNodeType(vector, 'class_declaration');
  const objectCount = countNodeType(vector, 'object');
  const funcCount = countNodeType(vector, 'function_declaration');
  const arrowCount = countNodeType(vector, 'arrow_function');

  return [
    { featureId: 'rest-route-structure', value: callCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'middleware-chain', value: callCount, signatureContributed: false },
    { featureId: 'controller-pattern', value: classCount > 0 ? 1 : 0, signatureContributed: classCount > 0 },
    { featureId: 'dto-validation', value: classCount, signatureContributed: false },
    { featureId: 'response-shape', value: objectCount > 0 ? 1 : 0, signatureContributed: objectCount > 0 },
  ];
};
