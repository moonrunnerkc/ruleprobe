/**
 * Option-extraction helpers used by prose-templates.ts to read values
 * out of ESLint rule option arrays.
 */

/** Extract a numeric option value from an ESLint rule's options. */
export function extractNumericOption(options: unknown[], key: string, fallback: number): number {
  if (options.length === 0) return fallback;
  const obj = options[0];
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    return typeof val === 'number' ? val : fallback;
  }
  return fallback;
}

/** Extract a numeric param from options (for rules like max-params where options is [number]). */
export function extractNumericParam(options: unknown[], fallback: number): number {
  if (options.length === 0) return fallback;
  const val = options[0];
  return typeof val === 'number' ? val : fallback;
}

/** Extract the allow list from no-console options. */
export function extractAllowList(options: unknown[]): string[] {
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
export function extractFilenameCases(options: unknown[]): string[] {
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
export function extractAllowEmptyCatch(options: unknown[]): boolean | undefined {
  if (options.length === 0) return undefined;
  const obj = options[0];
  if (obj && typeof obj === 'object' && 'allowEmptyCatch' in (obj as Record<string, unknown>)) {
    return Boolean((obj as Record<string, unknown>)['allowEmptyCatch']);
  }
  return undefined;
}

/** Extract terms from no-warning-comments options. */
export function extractWarningCommentTerms(options: unknown[]): string[] {
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
export function formatNamingConventionProse(options: unknown[]): string {
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
    parts.push(`Use PascalCase for ${humanizeSelectors(pascalSelectors)}.`);
  }
  if (camelSelectors.length > 0) {
    parts.push(`Use camelCase for ${humanizeSelectors(camelSelectors)}.`);
  }
  if (upperSelectors.length > 0) {
    parts.push(`Use UPPER_CASE for ${humanizeSelectors(upperSelectors)}.`);
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
  return selectors.map((s) => readable[s] ?? s).join(', ');
}
