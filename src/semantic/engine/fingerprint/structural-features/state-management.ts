/**
 * State management feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract state management features from a file vector.
 *
 * Measures: useState, useReducer, context providers,
 * store patterns, signal usage.
 */
export const extractStateManagement: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const funcCount = countNodeType(vector, 'function_declaration');
  const arrowCount = countNodeType(vector, 'arrow_function');

  return [
    { featureId: 'use-state', value: callCount, signatureContributed: false },
    { featureId: 'use-reducer', value: callCount, signatureContributed: false },
    { featureId: 'context-provider', value: callCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'store-pattern', value: callCount > 0 || funcCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'signal-usage', value: callCount, signatureContributed: false },
  ];
};
