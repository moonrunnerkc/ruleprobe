/**
 * Data fetching feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract data fetching features from a file vector.
 *
 * Measures: fetch API, axios, react-query, SWR, server actions,
 * loader functions, API route handlers.
 */
export const extractDataFetching: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const awaitCount = countNodeType(vector, 'await_expression');
  const funcCount = countNodeType(vector, 'function_declaration');
  const exportCount = countNodeType(vector, 'export_statement');

  return [
    { featureId: 'fetch-api', value: callCount, signatureContributed: false },
    { featureId: 'axios-call', value: callCount, signatureContributed: false },
    { featureId: 'react-query-hook', value: callCount, signatureContributed: false },
    { featureId: 'swr-hook', value: callCount, signatureContributed: false },
    { featureId: 'server-action', value: funcCount > 0 ? 1 : 0, signatureContributed: funcCount > 0 },
    { featureId: 'loader-function', value: exportCount > 0 && funcCount > 0 ? 1 : 0, signatureContributed: exportCount > 0 },
    { featureId: 'api-route-handler', value: exportCount > 0 && awaitCount > 0 ? 1 : 0, signatureContributed: exportCount > 0 },
  ];
};
