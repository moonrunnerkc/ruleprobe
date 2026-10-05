/**
 * Mapping: error-handling rules → ESLint equivalents
 *
 * Covers no-empty-catch.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-empty-catch pattern to no-empty (with allowEmptyCatch disabled). */
export function mapNoEmptyCatch(): EslintRuleEntry {
  return {
    ruleName: 'no-empty',
    severity: 'error',
    options: [{ allowEmptyCatch: false }],
    sourceRuleId: '',
    description: 'Catch blocks must not be empty',
  };
}
