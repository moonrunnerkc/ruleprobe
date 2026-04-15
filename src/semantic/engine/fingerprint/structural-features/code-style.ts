/**
 * Code style feature extraction from raw AST vectors.
 *
 * Measures: early returns, ternary usage, nesting depth,
 * const declarations, optional chaining.
 * Source: 29 CODE_STYLE statements in corpus + 6 not-verifiable rules.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType, getDepth } from './shared.js';

/**
 * Extract code style features from a file vector.
 */
export const extractCodeStyle: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const returnCount = countNodeType(vector, 'return_statement');
  const ternaryCount = countNodeType(vector, 'ternary_expression');
  const ifDepth = getDepth(vector, 'if_statement');
  const constCount = countNodeType(vector, 'variable_declarator');
  const memberCount = countNodeType(vector, 'member_expression');

  return [
    { featureId: 'early-return', value: returnCount, signatureContributed: false },
    { featureId: 'ternary-usage', value: ternaryCount, signatureContributed: false },
    { featureId: 'nesting-depth', value: ifDepth, signatureContributed: false },
    { featureId: 'const-declarations', value: constCount, signatureContributed: false },
    { featureId: 'optional-chain-usage', value: memberCount, signatureContributed: false },
  ];
};
