/**
 * Project-level rule pattern dictionary.
 *
 * Contains matchers for import restrictions and type safety.
 * Merged with other matcher arrays in rule-extractor.ts.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers covering import restrictions and type safety checks.
 */
export const PROJECT_RULE_MATCHERS: RuleMatcher[] = [
  {
    id: 'import-no-namespace',
    patterns: [
      /\bno\s+namespace\s+imports?\b/i,
      /\bno\s+import\s+\*\s+as\b/i,
      /\bavoid\s+(?:namespace|wildcard|star)\s+imports?\b/i,
      /\bdon'?t\s+use\s+import\s+\*\b/i,
      /\bno\s+(?:wildcard|star)\s+imports?\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'Namespace imports (import * as) are not allowed',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-namespace-imports', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'type-no-ts-directives',
    patterns: [
      /\bno\s+@?ts[\s-]ignore\b/i,
      /\bno\s+@?ts[\s-]nocheck\b/i,
      /\bno\s+@?ts[\s-]expect[\s-]error\b/i,
      /\bavoid\s+@?ts[\s-](?:ignore|nocheck|expect[\s-]error)\b/i,
      /\bdon'?t\s+use\s+@?ts[\s-](?:ignore|nocheck)\b/i,
      /\bno\s+typescript\s+(?:suppress|ignore)\s+(?:comments?|directives?)\b/i,
    ],
    category: 'type-safety',
    verifier: 'regex',
    description: 'TypeScript suppression directives must not be used',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-ts-directives', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-quote-style',
    patterns: [
      /\buse\s+single\s+quotes?\b/i,
      /\bsingle\s+quotes?\s+(?:only|always|required)\b/i,
      /\bprefer\s+single\s+quotes?\b/i,
      /\bstring\s+quotes?:?\s+single\b/i,
    ],
    category: 'code-style',
    verifier: 'regex',
    description: 'Strings must use single quotes',
    severity: 'warning',
    buildPattern: () => ({
      type: 'quote-style', target: '*.ts', expected: 'single', scope: 'file',
    }),
  },
];