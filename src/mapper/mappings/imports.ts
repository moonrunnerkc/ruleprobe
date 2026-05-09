/**
 * Mapping: import rules → ESLint equivalents
 *
 * Covers no-wildcard-exports, no-namespace-imports,
 * no-path-aliases, and no-deep-relative-imports.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-wildcard-exports pattern to import/no-anonymous-default-export. */
export function mapNoWildcardExports(): EslintRuleEntry {
  return {
    ruleName: 'import/no-anonymous-default-export',
    plugin: 'import',
    severity: 'warn',
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

/** Map no-deep-relative-imports pattern to import/no-relative-parent. */
export function mapNoDeepRelativeImports(expected: string | boolean): EslintRuleEntry {
  const maxDepth = typeof expected === 'string' ? parseInt(expected, 10) : 2;
  return {
    ruleName: 'import/no-relative-parent',
    plugin: 'import',
    severity: 'warn',
    options: [{ maxDepth: Number.isNaN(maxDepth) ? 2 : maxDepth }],
    sourceRuleId: '',
    description: 'Relative imports must not go too deep',
  };
}