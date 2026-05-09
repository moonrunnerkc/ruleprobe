/**
 * Prose templates for reverse mapping: ESLint rule -> human-readable instruction.
 *
 * Each template function takes an ESLint rule's options array and returns a
 * one-line prose instruction suitable for a CLAUDE.md rules section. Rules
 * with config args surface those args in the prose (e.g. "Files must not
 * exceed 300 lines").
 *
 * Stylistic rules (semi, quotes) have no meaningful prose equivalent and
 * are skipped during extraction.
 */

import {
  extractAllowEmptyCatch,
  extractAllowList,
  extractFilenameCases,
  extractNumericOption,
  extractNumericParam,
  extractWarningCommentTerms,
  formatNamingConventionProse,
} from './prose-template-helpers.js';

/**
 * Prose template lookup: ESLint rule name -> template function.
 *
 * Template functions receive the rule's options array and return a prose string.
 * Rules without meaningful config args can ignore the options parameter.
 */
const PROSE_TEMPLATES: ReadonlyMap<string, (options: unknown[]) => string> = new Map([
  // no-any
  ['@typescript-eslint/no-explicit-any', () => 'Never use the `any` type; narrow with schema checks or type guards at boundaries.'],

  // no-console
  ['no-console', (options: unknown[]) => {
    const allow = extractAllowList(options);
    if (allow.length === 0) {
      return 'No `console` statements in production code.';
    }
    return `No \`console\` statements except ${allow.map((m) => `\`${m}\``).join(', ')}.`;
  }],

  // named-exports
  ['import/no-default-export', () => 'Use named exports only; no default exports.'],

  // kebab-case files
  ['unicorn/filename-case', (options: unknown[]) => {
    const cases = extractFilenameCases(options);
    if (cases.length > 0) {
      return `File names must use ${cases.join(' or ')} naming.`;
    }
    return 'File names must use kebab-case.';
  }],

  // max-lines
  ['max-lines', (options: unknown[]) => {
    const max = extractNumericOption(options, 'max', 300);
    return `Files must not exceed ${max} lines.`;
  }],

  // max-len
  ['max-len', (options: unknown[]) => {
    const code = extractNumericOption(options, 'code', 120);
    return `Lines must not exceed ${code} characters.`;
  }],

  // jsdoc
  ['jsdoc/require-jsdoc', () => 'Every exported function must have a JSDoc comment.'],

  // code style
  ['no-var', () => 'Use `const` or `let`; never `var`.'],
  ['prefer-const', () => 'Prefer `const` for variables that are never reassigned.'],
  ['no-else-after-return', () => 'Do not use `else` after a `return`.'],
  ['no-nested-ternary', () => 'No nested ternary expressions.'],
  ['no-magic-numbers', () => 'Magic numbers must be replaced with named constants.'],

  // stylistic (no meaningful prose)
  ['semi', () => 'Enforce consistent semicolon usage.'],
  ['quotes', () => 'Enforce consistent quote style.'],

  // error handling
  ['no-empty', (options: unknown[]) => {
    const allowEmptyCatch = extractAllowEmptyCatch(options);
    if (allowEmptyCatch === false) {
      return 'Catch blocks must not be empty.';
    }
    return 'Empty blocks are not allowed.';
  }],
  ['no-throw-literal', () => 'Only `Error` objects may be thrown.'],

  // type safety
  ['@typescript-eslint/no-enum', () => 'Do not use enums; prefer union types.'],
  ['@typescript-eslint/consistent-type-assertions', () => 'Do not use type assertions (`as` casts).'],
  ['@typescript-eslint/no-non-null-assertion', () => 'Do not use non-null assertions (`!`).'],
  ['@typescript-eslint/no-implicit-any', () => 'No implicit `any` types.'],
  ['no-unused-vars', () => 'Exported declarations must be used by other files.'],
  ['@typescript-eslint/ban-ts-comment', () => 'Do not use TypeScript suppression directives (`@ts-expect-error`, etc.).'],

  // function limits
  ['max-lines-per-function', (options: unknown[]) => {
    const max = extractNumericOption(options, 'max', 50);
    return `Functions must not exceed ${max} lines.`;
  }],
  ['max-params', (options: unknown[]) => {
    const max = extractNumericParam(options, 4);
    return `Functions must not have more than ${max} parameters.`;
  }],

  // imports
  ['import/no-namespace', () => 'No wildcard imports; use named imports.'],
  ['@typescript-eslint/consistent-type-imports', () => 'Use `import type` for type-only imports.'],
  ['no-restricted-imports', () => 'Imports must use relative paths, not path aliases.'],

  // comments
  ['no-warning-comments', (options: unknown[]) => {
    const terms = extractWarningCommentTerms(options);
    if (terms.length > 0) {
      return `No ${terms.map((t) => `\`${t}\``).join(', ')} comments in production code.`;
    }
    return 'No TODO/FIXME/HACK/XXX comments in production code.';
  }],

  // naming convention (special: complex options)
  ['@typescript-eslint/naming-convention', (options: unknown[]) => formatNamingConventionProse(options)],
]);

/** Whether a rule is purely stylistic and should be skipped during extraction. */
const STYLISTIC_RULES: ReadonlySet<string> = new Set([
  'semi',
  'quotes',
]);

/**
 * Get the prose instruction for an ESLint rule.
 *
 * @param ruleName - The ESLint rule name
 * @param options - The rule's options array from the config
 * @returns The prose instruction string, or null if the rule is stylistic
 *          and should be skipped
 */
export function getProseForRule(ruleName: string, options: unknown[]): string | null {
  if (STYLISTIC_RULES.has(ruleName)) {
    return null;
  }
  const template = PROSE_TEMPLATES.get(ruleName);
  if (template) {
    return template(options);
  }
  return null;
}

/**
 * Check whether an ESLint rule is purely stylistic.
 *
 * Stylistic rules have no meaningful prose equivalent and should
 * be skipped during extraction.
 */
export function isStylisticRule(ruleName: string): boolean {
  return STYLISTIC_RULES.has(ruleName);
}
