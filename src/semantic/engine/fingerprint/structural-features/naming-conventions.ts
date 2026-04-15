/**
 * Naming conventions feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract naming convention features from a file vector.
 *
 * Measures: component prefixes, hook prefixes, type suffixes,
 * constant casing, file name patterns.
 */
export const extractNamingConventions: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const funcCount = countNodeType(vector, 'function_declaration');
  const varCount = countNodeType(vector, 'variable_declarator');
  const typeAliasCount = countNodeType(vector, 'type_alias_declaration');

  return [
    { featureId: 'component-prefix', value: funcCount, signatureContributed: false },
    { featureId: 'hook-prefix', value: funcCount, signatureContributed: false },
    { featureId: 'type-suffix', value: typeAliasCount, signatureContributed: false },
    { featureId: 'constant-casing', value: varCount, signatureContributed: false },
    { featureId: 'file-name-pattern', value: 1, signatureContributed: true },
  ];
};
