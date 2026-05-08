/**
 * Mapping: function size limit rules → ESLint equivalents
 *
 * Covers max-function-length and max-params.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map max-function-length pattern to max-lines-per-function. */
export function mapMaxFunctionLength(expected: string | boolean): EslintRuleEntry {
  const max = typeof expected === 'string' ? parseInt(expected, 10) : 50;
  return {
    ruleName: 'max-lines-per-function',
    severity: 'warn',
    options: [{ max: Number.isNaN(max) ? 50 : max, skipBlankLines: true, skipComments: true }],
    sourceRuleId: '',
    description: 'Functions must not exceed the maximum line count',
  };
}

/** Map max-params pattern to max-params. */
export function mapMaxParams(expected: string | boolean): EslintRuleEntry {
  const max = typeof expected === 'string' ? parseInt(expected, 10) : 4;
  return {
    ruleName: 'max-params',
    severity: 'warn',
    options: [Number.isNaN(max) ? 4 : max],
    sourceRuleId: '',
    description: 'Functions must not have too many parameters',
  };
}