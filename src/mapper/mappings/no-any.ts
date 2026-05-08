/**
 * Mapping: no-any → @typescript-eslint/no-explicit-any
 *
 * Bans the `any` type in TypeScript code.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-any pattern to @typescript-eslint/no-explicit-any. */
export function mapNoAny(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/no-explicit-any',
    plugin: '@typescript-eslint',
    severity: 'error',
    sourceRuleId: '',
    description: 'The "any" type must not be used',
  };
}