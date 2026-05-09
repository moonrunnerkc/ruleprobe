/**
 * Mapping: import rules → ESLint equivalents
 *
 * Covers no-wildcard-exports, no-namespace-imports,
 * no-path-aliases, and no-deep-relative-imports.
 */

import type { EslintRuleEntry } from '../types.js';

const DEFAULT_MAX_RELATIVE_DEPTH = 2;

/**
 * Map no-wildcard-exports pattern to no-restricted-syntax with an
 * ExportAllDeclaration selector. Uses a core ESLint rule so no plugin
 * is required; eslint-plugin-import has no rule that targets re-export
 * stars specifically.
 */
export function mapNoWildcardExports(): EslintRuleEntry {
  return {
    ruleName: 'no-restricted-syntax',
    severity: 'warn',
    options: [{
      selector: 'ExportAllDeclaration',
      message: 'Wildcard re-exports (export * from) are not allowed; use named re-exports.',
    }],
    sourceRuleId: '',
    description: 'No wildcard re-exports (use named re-exports)',
  };
}

/** Map no-namespace-imports pattern to import/no-namespace. */
export function mapNoNamespaceImports(): EslintRuleEntry {
  return {
    ruleName: 'import/no-namespace',
    plugin: 'import',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Namespace imports (import * as) are not allowed',
  };
}

/** Map no-path-aliases pattern to no-restricted-imports. */
export function mapNoPathAliases(): EslintRuleEntry {
  return {
    ruleName: 'no-restricted-imports',
    severity: 'warn',
    sourceRuleId: '',
    description: 'Imports must use relative paths, not path aliases',
  };
}

/**
 * Map no-deep-relative-imports to no-restricted-syntax with a regex
 * selector that flags imports traversing more than maxDepth parent
 * directories. eslint-plugin-import only ships an all-or-nothing
 * no-relative-parent-imports rule, so a regex selector is the closest
 * faithful translation of the depth-limit instruction.
 */
export function mapNoDeepRelativeImports(expected: string | boolean): EslintRuleEntry {
  const parsed = typeof expected === 'string' ? parseInt(expected, 10) : DEFAULT_MAX_RELATIVE_DEPTH;
  const maxDepth = Number.isNaN(parsed) || parsed < 1 ? DEFAULT_MAX_RELATIVE_DEPTH : parsed;
  const violatingDepth = maxDepth + 1;
  return {
    ruleName: 'no-restricted-syntax',
    severity: 'warn',
    options: [{
      selector: `ImportDeclaration[source.value=/^(\\.\\.\\/){${violatingDepth},}/]`,
      message: `Relative imports must not traverse more than ${maxDepth} parent directories.`,
    }],
    sourceRuleId: '',
    description: 'Relative imports must not go too deep',
  };
}
