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

/**
 * Prose template lookup: ESLint rule name -> template function.
 *
 * Template functions receive the rule's options array and return a prose string.
 * Rules without meaningful config args can ignore the options parameter.
 */
const PROSE_TEMPLATES: ReadonlyMap<string, (options: unknown[]) => string> = new Map([
  // no-any
  ['@typescript-eslint/no-explicit-any', (_options: unknown[]) => 'Never use the `any` type; narrow with schema checks or type guards at boundaries.'],

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
  ['jsdoc/require-jsdoc', (_options: unknown[]) => 'Every exported function must have a JSDoc comment.'],

  // code style
  ['no-var', (_options: unknown[]) => 'Use `const` or `let`; never `var`.'],
  ['prefer-const', (_options: unknown[]) => 'Prefer `const` for variables that are never reassigned.'],
  ['no-else-after-return', (_options: unknown[]) => 'Do not use `else` after a `return`.'],
  ['no-nested-ternary', (_options: unknown[]) => 'No nested ternary expressions.'],
  ['no-magic-numbers', (_options: unknown[]) => 'Magic numbers must be replaced with named constants.'],

  // stylistic (no meaningful prose)
  ['semi', (_options: unknown[]) => 'Enforce consistent semicolon usage.'],
  ['quotes', (_options: unknown[]) => 'Enforce consistent quote style.'],

  // error handling
  ['no-empty', (options: unknown[]) => {
    const allowEmptyCatch = extractAllowEmptyCatch(options);
    if (allowEmptyCatch === false) {
      return 'Catch blocks must not be empty.';
    }
    return 'Empty blocks are not allowed.';
  }],
  ['no-throw-literal', (_options: unknown[]) => 'Only `Error` objects may be thrown.'],

  // type safety
  ['@typescript-eslint/no-enum', (_options: unknown[]) => 'Do not use enums; prefer union types.'],
  ['@typescript-eslint/consistent-type-assertions', (_options: unknown[]) => 'Do not use type assertions (`as` casts).'],
  ['@typescript-eslint/no-non-null-assertion', (_options: unknown[]) => 'Do not use non-null assertions (`!`).'],
  ['@typescript-eslint/no-implicit-any', (_options: unknown[]) => 'No implicit `any` types.'],
  ['no-unused-vars', (_options: unknown[]) => 'Exported declarations must be used by other files.'],
  ['@typescript-eslint/ban-ts-comment', (_options: unknown[]) => 'Do not use TypeScript suppression directives (`@ts-expect-error`, etc.).'],

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
  ['import/no-namespace', (_options: unknown[]) => 'No wildcard imports; use named imports.'],
  ['@typescript-eslint/consistent-type-imports', (_options: unknown[]) => 'Use `import type` for type-only imports.'],
  ['no-restricted-imports', (_options: unknown[]) => 'Imports must use relative paths, not path aliases.'],
  ['import/no-relative-parent', (_options: unknown[]) => 'Relative imports must not traverse too many parent directories.'],

  // comments
  ['no-warning-comments', (options: unknown[]) => {
    const terms = extractWarningCommentTerms(options);
    if (terms.length > 0) {
      return `No ${terms.map((t) => `\`${t}\``).join(', ')} comments in production code.`;
    }
    return 'No TODO/FIXME/HACK/XXX comments in production code.';
  }],

  // naming convention (special: complex options)
  ['@typescript-eslint/naming-convention', (options: unknown[]) => {
    return formatNamingConventionProse(options);
  }],
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

// ── Option extraction helpers ──

/** Extract a numeric option value from an ESLint rule's options. */
function extractNumericOption(options: unknown[], key: string, fallback: number): number {
  if (options.length === 0) return fallback;
  const obj = options[0];
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    return typeof val === 'number' ? val : fallback;
  }
  return fallback;
}

/** Extract a numeric param from options (for rules like max-params where options is [number]). */
function extractNumericParam(options: unknown[], fallback: number): number {
  if (options.length === 0) return fallback;
  const val = options[0];
  return typeof val === 'number' ? val : fallback;
}

/** Extract the allow list from no-console options. */
function extractAllowList(options: unknown[]): string[] {
  if (options.length === 0) return [];
  const obj = options[0];
  if (obj && typeof obj === 'object' && 'allow' in (obj as Record<string, unknown>)) {
    const allow = (obj as Record<string, unknown>)['allow'];
    if (Array.isArray(allow)) {
      return allow.map(String);
    }
  }
  return [];
}

/** Extract filename cases from unicorn/filename-case options. */
function extractFilenameCases(options: unknown[]): string[] {
  if (options.length === 0) return [];
  const obj = options[0];
  if (obj && typeof obj === 'object' && 'cases' in (obj as Record<string, unknown>)) {
    const cases = (obj as Record<string, unknown>)['cases'];
    if (typeof cases === 'object' && cases !== null) {
      return Object.entries(cases as Record<string, unknown>)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    }
  }
  return [];
}

/** Extract allowEmptyCatch from no-empty options. */
function extractAllowEmptyCatch(options: unknown[]): boolean | undefined {
  if (options.length === 0) return undefined;
  const obj = options[0];
  if (obj && typeof obj === 'object' && 'allowEmptyCatch' in (obj as Record<string, unknown>)) {
    return Boolean((obj as Record<string, unknown>)['allowEmptyCatch']);
  }
  return undefined;
}

/** Extract terms from no-warning-comments options. */
function extractWarningCommentTerms(options: unknown[]): string[] {
  if (options.length === 0) return [];
  const obj = options[0];
  if (obj && typeof obj === 'object' && 'terms' in (obj as Record<string, unknown>)) {
    const terms = (obj as Record<string, unknown>)['terms'];
    if (Array.isArray(terms)) {
      return terms.map(String);
    }
  }
  return [];
}

/**
 * Format naming-convention prose from ESLint options.
 *
 * Parses the selector/format rules and produces natural-language
 * instructions like "Use PascalCase for types and interfaces.
 * Use camelCase for variables and functions."
 */
function formatNamingConventionProse(options: unknown[]): string {
  if (options.length === 0) return 'Enforce naming conventions for TypeScript identifiers.';

  const obj = options[0];
  if (!obj || typeof obj !== 'object' || !('rules' in (obj as Record<string, unknown>))) {
    return 'Enforce naming conventions for TypeScript identifiers.';
  }

  const rules = (obj as Record<string, unknown>)['rules'];
  if (!Array.isArray(rules)) {
    return 'Enforce naming conventions for TypeScript identifiers.';
  }

  const selectorFormats = new Map<string, Set<string>>();

  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) continue;
    const r = rule as Record<string, unknown>;
    const selector = String(r['selector'] ?? 'default');
    const format = r['format'];
    if (Array.isArray(format)) {
      const existing = selectorFormats.get(selector) ?? new Set();
      for (const f of format) {
        existing.add(String(f));
      }
      selectorFormats.set(selector, existing);
    }
  }

  const parts: string[] = [];

  const pascalSelectors: string[] = [];
  const camelSelectors: string[] = [];
  const upperSelectors: string[] = [];

  for (const [selector, formats] of selectorFormats) {
    if (formats.has('PascalCase')) pascalSelectors.push(selector);
    if (formats.has('camelCase')) camelSelectors.push(selector);
    if (formats.has('UPPER_CASE')) upperSelectors.push(selector);
  }

  if (pascalSelectors.length > 0) {
    const names = humanizeSelectors(pascalSelectors);
    parts.push(`Use PascalCase for ${names}.`);
  }
  if (camelSelectors.length > 0) {
    const names = humanizeSelectors(camelSelectors);
    parts.push(`Use camelCase for ${names}.`);
  }
  if (upperSelectors.length > 0) {
    const names = humanizeSelectors(upperSelectors);
    parts.push(`Use UPPER_CASE for ${names}.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Enforce naming conventions for TypeScript identifiers.';
}

/** Convert ESLint selector names to human-readable form. */
function humanizeSelectors(selectors: string[]): string {
  const readable: Record<string, string> = {
    'class': 'classes',
    'interface': 'interfaces',
    'typeAlias': 'type aliases',
    'enum': 'enums',
    'enumMember': 'enum members',
    'variable': 'variables',
    'function': 'functions',
    'parameter': 'parameters',
    'classMethod': 'class methods',
    'classProperty': 'class properties',
    'objectLiteralProperty': 'object properties',
    'typeProperty': 'type properties',
    'default': 'identifiers',
  };
  return selectors
    .map((s) => readable[s] ?? s)
    .join(', ');
}