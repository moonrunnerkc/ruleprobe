/**
 * Mapping: max-file-length → max-lines
 *
 * Enforces a maximum number of lines per file.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map max-file-length pattern to max-lines ESLint rule. */
export function mapMaxFileLines(expected: string | boolean): EslintRuleEntry {
  const max = typeof expected === 'string' ? parseInt(expected, 10) : 300;
  return {
    ruleName: 'max-lines',
    severity: 'warn',
    options: [{ max: Number.isNaN(max) ? 300 : max, skipBlankLines: true, skipComments: true }],
    sourceRuleId: '',
    description: 'Files must not exceed the maximum line count',
  };
}

/** Map max-line-length pattern to max-len ESLint rule. */
export function mapMaxLineLength(expected: string | boolean): EslintRuleEntry {
  const code = typeof expected === 'string' ? parseInt(expected, 10) : 120;
  return {
    ruleName: 'max-len',
    severity: 'warn',
    options: [{ code: Number.isNaN(code) ? 120 : code }],
    sourceRuleId: '',
    description: 'Lines must not exceed the maximum length',
  };
}