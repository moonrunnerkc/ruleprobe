/**
 * Testing patterns feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract testing pattern features from a file vector.
 *
 * Measures: describe/it blocks, test functions, arrange-act-assert,
 * factory functions, before/after hooks, mock usage, snapshot tests.
 */
export const extractTestingPatterns: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const funcCount = countNodeType(vector, 'function_declaration');
  const arrowCount = countNodeType(vector, 'arrow_function');

  return [
    { featureId: 'describe-it-blocks', value: callCount, signatureContributed: false },
    { featureId: 'test-function', value: callCount, signatureContributed: false },
    { featureId: 'arrange-act-assert', value: callCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'factory-function', value: funcCount, signatureContributed: false },
    { featureId: 'before-after-hooks', value: callCount, signatureContributed: false },
    { featureId: 'mock-usage', value: callCount, signatureContributed: false },
    { featureId: 'snapshot-test', value: callCount > 0 ? 1 : 0, signatureContributed: false },
  ];
};
