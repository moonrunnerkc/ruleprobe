/**
 * Mapping: jsdoc-required → jsdoc/require-jsdoc
 *
 * Requires JSDoc comments on public functions.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map jsdoc-required pattern to jsdoc/require-jsdoc. */
export function mapJsdocRequired(): EslintRuleEntry {
  return {
    ruleName: 'jsdoc/require-jsdoc',
    plugin: 'jsdoc',
    severity: 'warn',
    options: [{
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: true,
        FunctionExpression: true,
      },
      publicOnly: true,
    }],
    sourceRuleId: '',
    description: 'Every public function must have a JSDoc comment',
  };
}