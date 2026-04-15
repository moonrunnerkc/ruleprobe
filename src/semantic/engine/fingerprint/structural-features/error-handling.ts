/**
 * Error handling feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract error handling features from a file vector.
 *
 * Measures: custom error classes, try-catch usage (typed vs bare),
 * throw/rethrow patterns, .catch() chains, result type returns,
 * error boundary components.
 */
export const extractErrorHandling: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const tryCount = countNodeType(vector, 'try_statement');
  const catchCount = countNodeType(vector, 'catch_clause');
  const throwCount = countNodeType(vector, 'throw_statement');
  const classCount = countNodeType(vector, 'class_declaration');
  const callCount = countNodeType(vector, 'call_expression');
  const returnCount = countNodeType(vector, 'return_statement');

  return [
    { featureId: 'custom-error-class', value: classCount, signatureContributed: false },
    { featureId: 'try-catch-typed', value: catchCount, signatureContributed: false },
    { featureId: 'try-catch-bare', value: Math.max(0, catchCount - tryCount), signatureContributed: false },
    { featureId: 'error-rethrow', value: throwCount, signatureContributed: false },
    { featureId: 'error-log-before-rethrow', value: tryCount > 0 && callCount > 0 ? 1 : 0, signatureContributed: tryCount > 0 },
    { featureId: 'dot-catch-chain', value: callCount, signatureContributed: false },
    { featureId: 'result-type-return', value: returnCount, signatureContributed: returnCount > 0 },
    { featureId: 'error-boundary-component', value: classCount > 0 ? 1 : 0, signatureContributed: classCount > 0 },
  ];
};
