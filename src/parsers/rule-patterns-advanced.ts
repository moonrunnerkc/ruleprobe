/**
 * Advanced rule matchers: type-aware AST checks.
 *
 * Contains matchers that require --project for type-aware analysis.
 * Merged with other matcher arrays in rule-extractor.ts.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers for type-aware TypeScript checks.
 */
export const ADVANCED_RULE_MATCHERS: RuleMatcher[] = [
  // Type-aware checks (require --project flag)
  {
    id: 'type-no-implicit-any',
    patterns: [
      /\bno\s+implicit\s+any\b/i,
      /\bnoImplicitAny\b/i,
      /\bexplicit\s+type\s+annotations?\b/i,
      /\bavoid\s+implicit\s+any\b/i,
      /\ball\s+(?:variables?|params?|parameters?)\s+must\s+(?:have|be)\s+typed\b/i,
    ],
    category: 'type-safety',
    verifier: 'ast',
    description: 'No implicit any types (requires --project for type-aware analysis)',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-implicit-any', target: '*.ts', expected: false, scope: 'project',
    }),
  },
  {
    id: 'structure-no-unused-exports',
    patterns: [
      /\bno\s+unused\s+exports?\b/i,
      /\bremove\s+unused\s+exports?\b/i,
      /\bexports?\s+must\s+be\s+(?:used|imported|referenced)\b/i,
      /\bdon'?t\s+export\s+(?:unused|dead)\b/i,
      /\bno\s+dead\s+exports?\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Exported declarations must be imported by other files (requires --project)',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-unused-exports', target: '*.ts', expected: false, scope: 'project',
    }),
  },

  // Additional regex checks
  {
    id: 'forbidden-no-todo-comments',
    patterns: [
      /\bno\s+TODO\s+comments?\b/i,
      /\bTODO\b.*\bnot\s+allowed\b/i,
      /\bremove\s+(?:all\s+)?TODO\b/i,
      /\bno\s+(?:FIXME|HACK|XXX)\b/i,
      /\bclean\s+up\s+(?:TODO|FIXME)\b/i,
    ],
    category: 'code-style',
    verifier: 'regex',
    description: 'No TODO/FIXME/HACK/XXX comments in production code',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-todo-comments', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-consistent-semicolons',
    patterns: [
      /\bconsistent\s+semicolons?\b/i,
      /\balways\s+use\s+semicolons?\b/i,
      /\bno\s+semicolons?\b/i,
      /\brequire\s+semicolons?\b/i,
      /\bsemicolon\s+(?:style|usage|enforcement)\b/i,
    ],
    category: 'code-style',
    verifier: 'regex',
    description: 'Enforce consistent semicolon usage',
    severity: 'warning',
    buildPattern: (line: string) => {
      const noSemi = /\bno\s+semicolons?\b/i.test(line);
      return {
        type: 'consistent-semicolons', target: '*.ts', expected: noSemi ? 'never' : 'always', scope: 'file',
      };
    },
  },

  // Additional AST checks
  {
    id: 'forbidden-no-var',
    patterns: [
      /\bno\s+var\b/i,
      /\bdon'?t\s+use\s+var\b/i,
      /\bavoid\s+var\b/i,
      /\buse\s+(?:const|let)\s+instead\s+of\s+var\b/i,
      /\bnever\s+use\s+var\b/i,
      /\bvar\s+is\s+(?:not\s+allowed|forbidden|banned)\b/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'No var declarations (use const or let)',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-var', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-prefer-const',
    patterns: [
      /\bprefer\s+const\b/i,
      /\buse\s+const\b.*\bnot\s+(?:let|reassigned)\b/i,
      /\bconst\s+over\s+let\b/i,
      /\bimmutable\s+by\s+default\b/i,
      /\bconst\s+(?:where|when)\s+possible\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Prefer const for variables that are never reassigned',
    severity: 'warning',
    buildPattern: () => ({
      type: 'prefer-const', target: '*.ts', expected: 'const', scope: 'file',
    }),
  },
  {
    id: 'import-no-wildcard-exports',
    patterns: [
      /\bno\s+(?:wildcard|star)\s+(?:re-?)?exports?\b/i,
      /\bavoid\s+export\s*\*/i,
      /\bdon'?t\s+use\s+export\s*\*/i,
      /\bno\s+export\s*\*\b/i,
      /\bnamed\s+re-?exports?\s+(?:only|instead)\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'No wildcard re-exports (use named re-exports)',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-wildcard-exports', target: '*.ts', expected: false, scope: 'file',
    }),
  },
];