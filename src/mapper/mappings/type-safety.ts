/**
 * Mapping: type-safety rules → ESLint equivalents
 *
 * Covers no-enum, no-type-assertions, no-non-null-assertions,
 * no-implicit-any, no-unused-exports, and no-ts-directives.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-enum pattern to @typescript-eslint/no-enum. */
export function mapNoEnum(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/no-enum',
    plugin: '@typescript-eslint',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Enums must not be used; prefer union types',
  };
}

/** Map no-type-assertions pattern to @typescript-eslint/consistent-type-assertions. */
export function mapNoTypeAssertions(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/consistent-type-assertions',
    plugin: '@typescript-eslint',
    severity: 'warn',
    options: [{ assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
    sourceRuleId: '',
    description: 'Type assertions (as casts) must not be used',
  };
}

/** Map no-non-null-assertions pattern to @typescript-eslint/no-non-null-assertion. */
export function mapNonNullAssertions(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/no-non-null-assertion',
    plugin: '@typescript-eslint',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Non-null assertions (!) must not be used',
  };
}

/** Map no-implicit-any pattern to @typescript-eslint/no-explicit-any.
 * Note: implicit any is caught by TypeScript's noImplicitAny compiler option,
 * not by an ESLint rule. This maps to the closest ESLint equivalent. */
export function mapNoImplicitAny(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/no-explicit-any',
    plugin: '@typescript-eslint',
    severity: 'warn',
    sourceRuleId: '',
    description: 'No implicit any types (use @typescript-eslint/no-explicit-any; enable noImplicitAny in tsconfig)',
  };
}

/** Map no-unused-exports pattern to import/no-unused-modules. */
export function mapNoUnusedExports(): EslintRuleEntry {
  return {
    ruleName: 'import/no-unused-modules',
    plugin: 'import',
    severity: 'warn',
    options: [{ missingExports: true, unusedExports: true }],
    sourceRuleId: '',
    description: 'Exported declarations must be imported by other files',
  };
}

/** Map no-ts-directives pattern to @typescript-eslint/ban-ts-comment. */
export function mapNoTsDirectives(): EslintRuleEntry {
  return {
    ruleName: '@typescript-eslint/ban-ts-comment',
    plugin: '@typescript-eslint',
    severity: 'error',
    options: [{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false }],
    sourceRuleId: '',
    description: 'TypeScript suppression directives must not be used',
  };
}