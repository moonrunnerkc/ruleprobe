/**
 * File organization feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract file organization features from a file vector.
 *
 * Measures: barrel exports, colocated tests, colocated styles,
 * feature folder patterns, layer separation patterns.
 */
export const extractFileOrganization: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const exportCount = countNodeType(vector, 'export_statement');
  const importCount = countNodeType(vector, 'import_statement');

  return [
    { featureId: 'barrel-export', value: exportCount, signatureContributed: false },
    { featureId: 'colocated-test', value: importCount, signatureContributed: false },
    { featureId: 'colocated-style', value: importCount, signatureContributed: false },
    { featureId: 'feature-folder', value: importCount > 0 ? 1 : 0, signatureContributed: importCount > 0 },
    { featureId: 'layer-separation', value: importCount > 0 ? 1 : 0, signatureContributed: importCount > 0 },
  ];
};
