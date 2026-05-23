/**
 * Bidirectional mapping table: RuleProbe pattern types <-> ESLint rule names.
 *
 * Single source of truth for the relationship between RuleProbe's internal
 * pattern types and ESLint rule names. Consumed forward by the mapper
 * (src/mapper/) and in reverse by the extractor (src/extractor/).
 *
 * Rules marked stylistic have no meaningful prose equivalent and are
 * skipped during extraction.
 */

/** A single entry in the bidirectional mapping table. */
export interface MappingEntry {
  /** RuleProbe pattern type, e.g. "no-any" or "max-file-length". */
  patternType: string;
  /** ESLint rule name, e.g. "@typescript-eslint/no-explicit-any". */
  eslintRuleName: string;
  /** ESLint plugin, e.g. "@typescript-eslint" or "import". */
  plugin?: string;
  /** Default severity when mapping forward. */
  defaultSeverity: 'error' | 'warn';
  /** One-line description of what this rule enforces. */
  description: string;
  /** True if this rule is purely stylistic and should be skipped during extraction. */
  isStylistic?: boolean;
}

/**
 * Pattern types with no ESLint equivalent.
 *
 * Key is the pattern type, value is a one-line reason explaining why.
 * Only includes types produced by remaining matchers.
 */
export const UNMAPPABLE_TYPES: Record<string, string> = {};

/**
 * The bidirectional mapping table.
 *
 * Each entry links a RuleProbe pattern type to its ESLint rule equivalent.
 * The forward mapper (src/mapper/) uses this for patternType lookup.
 * The reverse extractor (src/extractor/) uses this for eslintRuleName lookup.
 */
export const MAPPINGS: MappingEntry[] = [
  // no-any
  { patternType: 'no-any', eslintRuleName: '@typescript-eslint/no-explicit-any', plugin: '@typescript-eslint', defaultSeverity: 'error', description: 'The "any" type must not be used' },

  // no-console
  { patternType: 'no-console-log', eslintRuleName: 'no-console', defaultSeverity: 'error', description: 'console.log must not be used in production code' },
  { patternType: 'no-console-extended', eslintRuleName: 'no-console', defaultSeverity: 'error', description: 'Console statements must not be used' },

  // named-exports
  { patternType: 'named-exports-only', eslintRuleName: 'import/no-default-export', plugin: 'import', defaultSeverity: 'error', description: 'Only named exports are allowed, no default exports' },

  // kebab-case files
  { patternType: 'kebab-case', eslintRuleName: 'unicorn/filename-case', plugin: 'unicorn', defaultSeverity: 'error', description: 'File names must use kebab-case' },

  // max-lines
  { patternType: 'max-file-length', eslintRuleName: 'max-lines', defaultSeverity: 'warn', description: 'Files must not exceed the maximum line count' },
  { patternType: 'max-line-length', eslintRuleName: 'max-len', defaultSeverity: 'warn', description: 'Lines must not exceed the maximum length' },

  // jsdoc
  { patternType: 'jsdoc-required', eslintRuleName: 'jsdoc/require-jsdoc', plugin: 'jsdoc', defaultSeverity: 'warn', description: 'Every public function must have a JSDoc comment' },

  // code style
  { patternType: 'no-var', eslintRuleName: 'no-var', defaultSeverity: 'error', description: 'No var declarations (use const or let)' },
  { patternType: 'prefer-const', eslintRuleName: 'prefer-const', defaultSeverity: 'warn', description: 'Prefer const for variables that are never reassigned' },
  { patternType: 'no-else-after-return', eslintRuleName: 'no-else-after-return', defaultSeverity: 'warn', description: 'Do not use else after a return statement' },
  { patternType: 'no-nested-ternary', eslintRuleName: 'no-nested-ternary', defaultSeverity: 'warn', description: 'Nested ternary expressions are not allowed' },
  { patternType: 'no-magic-numbers', eslintRuleName: 'no-magic-numbers', defaultSeverity: 'warn', description: 'Magic numbers must be replaced with named constants' },
  { patternType: 'consistent-semicolons', eslintRuleName: 'semi', defaultSeverity: 'warn', description: 'Enforce consistent semicolon usage', isStylistic: true },
  { patternType: 'quote-style', eslintRuleName: 'quotes', defaultSeverity: 'warn', description: 'Enforce consistent quote style', isStylistic: true },

  // error handling
  { patternType: 'no-empty-catch', eslintRuleName: 'no-empty', defaultSeverity: 'error', description: 'Catch blocks must not be empty' },
  { patternType: 'throw-error-only', eslintRuleName: 'no-throw-literal', defaultSeverity: 'error', description: 'Only Error objects may be thrown' },

  // type safety
  { patternType: 'no-enum', eslintRuleName: 'no-restricted-syntax', defaultSeverity: 'warn', description: 'Enums must not be used; prefer union types' },
  { patternType: 'no-type-assertions', eslintRuleName: '@typescript-eslint/consistent-type-assertions', plugin: '@typescript-eslint', defaultSeverity: 'warn', description: 'Type assertions (as casts) must not be used' },
  { patternType: 'no-non-null-assertions', eslintRuleName: '@typescript-eslint/no-non-null-assertion', plugin: '@typescript-eslint', defaultSeverity: 'warn', description: 'Non-null assertions (!) must not be used' },
  { patternType: 'no-implicit-any', eslintRuleName: '@typescript-eslint/no-implicit-any', plugin: '@typescript-eslint', defaultSeverity: 'warn', description: 'No implicit any types' },
  { patternType: 'no-unused-exports', eslintRuleName: 'import/no-unused-modules', plugin: 'import', defaultSeverity: 'warn', description: 'Exported declarations must be imported by other files' },
  { patternType: 'no-ts-directives', eslintRuleName: '@typescript-eslint/ban-ts-comment', plugin: '@typescript-eslint', defaultSeverity: 'error', description: 'TypeScript suppression directives must not be used' },

  // function limits
  { patternType: 'max-function-length', eslintRuleName: 'max-lines-per-function', defaultSeverity: 'warn', description: 'Functions must not exceed the maximum line count' },
  { patternType: 'max-params', eslintRuleName: 'max-params', defaultSeverity: 'warn', description: 'Functions must not have too many parameters' },

  // imports
  { patternType: 'no-wildcard-exports', eslintRuleName: 'no-restricted-syntax', defaultSeverity: 'warn', description: 'No wildcard re-exports (use named re-exports)' },
  { patternType: 'no-namespace-imports', eslintRuleName: 'import/no-namespace', plugin: 'import', defaultSeverity: 'warn', description: 'Namespace imports (import * as) are not allowed' },
  { patternType: 'no-path-aliases', eslintRuleName: 'no-restricted-imports', defaultSeverity: 'warn', description: 'Imports must use relative paths, not path aliases' },
  { patternType: 'no-deep-relative-imports', eslintRuleName: 'no-restricted-syntax', defaultSeverity: 'warn', description: 'Relative imports must not go too deep' },

  // comments
  { patternType: 'no-todo-comments', eslintRuleName: 'no-warning-comments', defaultSeverity: 'warn', description: 'No TODO/FIXME/HACK/XXX comments in production code' },

  // naming convention (special: multiple pattern types map to one ESLint rule)
  { patternType: 'PascalCase', eslintRuleName: '@typescript-eslint/naming-convention', plugin: '@typescript-eslint', defaultSeverity: 'error', description: 'Use PascalCase for types and interfaces' },
  { patternType: 'camelCase', eslintRuleName: '@typescript-eslint/naming-convention', plugin: '@typescript-eslint', defaultSeverity: 'error', description: 'Use camelCase for variables and functions' },
  { patternType: 'UPPER_CASE', eslintRuleName: '@typescript-eslint/naming-convention', plugin: '@typescript-eslint', defaultSeverity: 'error', description: 'Use UPPER_CASE for constants' },
];

/** Find a mapping entry by RuleProbe pattern type. */
export function findByPatternType(patternType: string): MappingEntry | undefined {
  return MAPPINGS.find((m) => m.patternType === patternType);
}

/** Find all mapping entries for an ESLint rule name (may return multiple for many-to-one mappings). */
export function findAllByEslintRuleName(eslintRuleName: string): MappingEntry[] {
  return MAPPINGS.filter((m) => m.eslintRuleName === eslintRuleName);
}

/** Find the first mapping entry for an ESLint rule name. */
export function findByEslintRuleName(eslintRuleName: string): MappingEntry | undefined {
  return MAPPINGS.find((m) => m.eslintRuleName === eslintRuleName);
}