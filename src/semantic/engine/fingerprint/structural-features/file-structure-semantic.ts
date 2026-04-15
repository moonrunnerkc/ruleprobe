/**
 * File structure semantic feature extraction from raw AST vectors.
 *
 * Measures: barrel export counts, import locality patterns.
 * Source: 67 FILE_STRUCTURE statements in corpus + 3 not-verifiable rules.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract file structure semantic features from a file vector.
 */
export const extractFileStructureSemantic: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const exportCount = countNodeType(vector, 'export_statement');
  const importCount = countNodeType(vector, 'import_statement');

  return [
    { featureId: 'barrel-export-count', value: exportCount, signatureContributed: false },
    { featureId: 'import-locality', value: importCount > 0 ? 1 : 0, signatureContributed: importCount > 0 },
  ];
};
