/**
 * Component structure feature extraction from raw AST vectors.
 */

import type { RawFileVector } from '../../../types.js';
import type { FeatureExtraction, FeatureExtractor } from './shared.js';
import { countNodeType } from './shared.js';

/**
 * Extract component structure features from a file vector.
 *
 * Measures: functional vs class components, hooks usage,
 * prop destructuring, prop interfaces, forward-ref, compound
 * components, render props.
 */
export const extractComponentStructure: FeatureExtractor = (
  vector: RawFileVector,
): FeatureExtraction[] => {
  const funcCount = countNodeType(vector, 'function_declaration');
  const arrowCount = countNodeType(vector, 'arrow_function');
  const classCount = countNodeType(vector, 'class_declaration');
  const callCount = countNodeType(vector, 'call_expression');
  const objectPatternCount = countNodeType(vector, 'object_pattern');
  const interfaceCount = countNodeType(vector, 'interface_declaration');
  const assignCount = countNodeType(vector, 'assignment_expression');

  return [
    { featureId: 'functional-component', value: funcCount + arrowCount, signatureContributed: false },
    { featureId: 'class-component', value: classCount, signatureContributed: false },
    { featureId: 'hooks-usage', value: callCount, signatureContributed: false },
    { featureId: 'prop-destructuring', value: objectPatternCount, signatureContributed: false },
    { featureId: 'prop-interface', value: interfaceCount, signatureContributed: false },
    { featureId: 'forward-ref', value: callCount > 0 ? 1 : 0, signatureContributed: callCount > 0 },
    { featureId: 'compound-component', value: assignCount, signatureContributed: assignCount > 0 },
    { featureId: 'render-prop', value: arrowCount, signatureContributed: arrowCount > 0 },
  ];
};
