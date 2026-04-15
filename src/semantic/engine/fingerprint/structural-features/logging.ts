/**
 * Logging feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract logging features from a file vector.
 *
 * Measures: structured log calls, log level usage,
 * context propagation, logger injection.
 */
export const extractLogging: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const memberCount = countNodeType(vector, 'member_expression');
  const paramCount = countNodeType(vector, 'formal_parameters');

  return [
    { featureId: 'structured-log-call', value: callCount, signatureContributed: false },
    { featureId: 'log-level-usage', value: memberCount, signatureContributed: false },
    { featureId: 'context-propagation', value: callCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'logger-injection', value: paramCount, signatureContributed: false },
  ];
};
