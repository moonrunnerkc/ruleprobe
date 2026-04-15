/**
 * Language requirements feature extraction from raw AST vectors.
 *
 * Measures: type annotations, any-type usage, type assertions,
 * interface declarations.
 * Source: 31 LANGUAGE_SPECIFIC statements in corpus + 4 not-verifiable rules.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract language requirement features from a file vector.
 */
export const extractLanguageRequirements: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const typeAnnotations = countNodeType(vector, 'type_annotation');
  const anyUsage = countNodeType(vector, 'predefined_type');
  const asExpressions = countNodeType(vector, 'as_expression');
  const interfaces = countNodeType(vector, 'interface_declaration');

  return [
    { featureId: 'type-annotation-count', value: typeAnnotations, signatureContributed: false },
    { featureId: 'any-type-usage', value: anyUsage, signatureContributed: false },
    { featureId: 'type-assertion-count', value: asExpressions, signatureContributed: false },
    { featureId: 'interface-count', value: interfaces, signatureContributed: false },
  ];
};
