/**
 * Mapping: error-handling rules → ESLint equivalents
 *
 * Covers no-empty-catch and throw-error-only.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-empty-catch pattern to no-empty (with allowCatchParents opt). */
export function mapNoEmptyCatch(): EslintRuleEntry {
  return {
    ruleName: 'no-empty',
    severity: 'error',
    options: [{ allowEmptyCatch: false }],
    sourceRuleId: '',
    description: 'Catch blocks must not be empty',
  };
}

/** Map throw-error-only pattern to no-throw-literal. */
export function mapThrowErrorOnly(): EslintRuleEntry {
  return {
    ruleName: 'no-throw-literal',
    severity: 'error',
    sourceRuleId: '',
    description: 'Only Error objects may be thrown',
  };
}