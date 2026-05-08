/**
 * Mapping: code-style rules → ESLint equivalents
 *
 * Covers no-var, prefer-const, no-else-after-return,
 * no-nested-ternary, no-magic-numbers, semicolons, and quotes.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-var pattern. */
export function mapNoVar(): EslintRuleEntry {
  return {
    ruleName: 'no-var',
    severity: 'error',
    sourceRuleId: '',
    description: 'No var declarations (use const or let)',
  };
}

/** Map prefer-const pattern. */
export function mapPreferConst(): EslintRuleEntry {
  return {
    ruleName: 'prefer-const',
    severity: 'warn',
    options: [{ destructuring: 'all' }],
    sourceRuleId: '',
    description: 'Prefer const for variables that are never reassigned',
  };
}

/** Map no-else-after-return pattern. */
export function mapNoElseAfterReturn(): EslintRuleEntry {
  return {
    ruleName: 'no-else-after-return',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Do not use else after a return statement',
  };
}

/** Map no-nested-ternary pattern. */
export function mapNoNestedTernary(): EslintRuleEntry {
  return {
    ruleName: 'no-nested-ternary',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Nested ternary expressions are not allowed',
  };
}

/** Map no-magic-numbers pattern. */
export function mapNoMagicNumbers(): EslintRuleEntry {
  return {
    ruleName: 'no-magic-numbers',
    severity: 'warn',
    options: [{ ignore: [0, 1, -1], ignoreArrayIndexes: true, detectObjects: false }],
    sourceRuleId: '',
    description: 'Magic numbers must be replaced with named constants',
  };
}

/** Map consistent-semicolons pattern to semi rule. */
export function mapConsistentSemicolons(expected: string | boolean): EslintRuleEntry {
  const semiStyle = expected === 'never' ? 'never' : 'always';
  return {
    ruleName: 'semi',
    severity: 'warn',
    options: [semiStyle],
    sourceRuleId: '',
    description: 'Enforce consistent semicolon usage',
  };
}

/** Map quote-style pattern to quotes rule. */
export function mapQuoteStyle(expected: string | boolean): EslintRuleEntry {
  const quoteType = expected === 'single' ? 'single' : 'double';
  return {
    ruleName: 'quotes',
    severity: 'warn',
    options: ['error', quoteType, { avoidEscape: true }],
    sourceRuleId: '',
    description: `Strings must use ${quoteType} quotes`,
  };
}