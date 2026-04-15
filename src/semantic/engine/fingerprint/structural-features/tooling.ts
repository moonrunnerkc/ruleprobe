/**
 * Tooling feature extraction from raw AST vectors.
 *
 * Measures: build script calls, tool imports, config file patterns.
 * Source: 1,238 TOOLING_COMMAND statements in corpus (24.3% of all).
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract tooling features from a file vector.
 *
 * Measures build-related calls, tool imports, and config patterns.
 */
export const extractTooling: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const callCount = countNodeType(vector, 'call_expression');
  const importCount = countNodeType(vector, 'import_statement');

  return [
    { featureId: 'build-script-call', value: callCount, signatureContributed: false },
    { featureId: 'tool-import', value: importCount, signatureContributed: false },
    { featureId: 'config-file-presence', value: importCount > 0 ? 1 : 0, signatureContributed: importCount > 0 },
  ];
};
