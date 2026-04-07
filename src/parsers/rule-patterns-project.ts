/**
 * Project-level and testing rule pattern dictionary.
 *
 * Contains matchers for test quality, import restrictions,
 * project structure, dependency management, and regex-based
 * code quality checks. Merged with other matcher arrays
 * in rule-extractor.ts.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers covering testing patterns, import restrictions,
 * project structure, and dependency constraints.
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
    id: 'structure-no-barrel-files',
    patterns: [
      /\bno\s+barrel\s+(?:files?|re[\s-]?exports?)\b/i,
      /\bavoid\s+barrel\s+(?:files?|re[\s-]?exports?)\b/i,
      /\bdon'?t\s+use\s+barrel\s+(?:files?|re[\s-]?exports?)\b/i,
      /\bno\s+(?:barrel|index)\s+(?:re[\s-]?)?exports?\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Barrel files (index.ts with only re-exports) are not allowed',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-barrel-files', target: 'index.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'test-no-settimeout',
    patterns: [
      /\bno\s+setTimeout\s+in\s+tests?\b/i,
      /\bavoid\s+setTimeout\s+in\s+tests?\b/i,
      /\bdon'?t\s+use\s+setTimeout\s+in\s+tests?\b/i,
      /\bno\s+timers?\s+in\s+tests?\b/i,
    ],
    category: 'test-requirement',
    verifier: 'ast',
    description: 'setTimeout/setInterval must not be used in test files',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-setTimeout-in-tests', target: '*.test.ts', expected: false, scope: 'file',
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
    id: 'test-no-only',
    patterns: [
      /\bno\s+\.only\s*\(\b/i,
      /\bno\s+(?:test|describe|it)\.only\b/i,
      /\bdon'?t\s+(?:use|leave)\s+\.only\b/i,
      /\bavoid\s+\.only\b.*\btests?\b/i,
      /\bno\s+focused\s+tests?\b/i,
    ],
    category: 'test-requirement',
    verifier: 'regex',
    description: 'Test .only() calls must not be committed',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-test-only', target: '*.test.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'test-no-skip',
    patterns: [
      /\bno\s+\.skip\s*\(\b/i,
      /\bno\s+(?:test|describe|it)\.skip\b/i,
      /\bdon'?t\s+(?:use|leave)\s+\.skip\b/i,
      /\bavoid\s+\.skip\b.*\btests?\b/i,
      /\bno\s+skipped\s+tests?\b/i,
    ],
    category: 'test-requirement',
    verifier: 'regex',
    description: 'Test .skip() calls must not be committed',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-test-skip', target: '*.test.ts', expected: false, scope: 'file',
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
  {
    id: 'import-banned-package',
    patterns: [
      /\b(?:don'?t|do\s+not|never)\s+(?:import|use)\s+(?:the\s+)?(\w[\w.-]*)\s+(?:package|library|module)\b/i,
      /\b(?:ban(?:ned)?|forbid(?:den)?|prohibit(?:ed)?)\s+(?:package|import|library):?\s+(\w[\w.-]*)\b/i,
      /\bno\s+(\w[\w.-]*)\s+(?:imports?|dependency|package)\b/i,
    ],
    category: 'dependency',
    verifier: 'regex',
    description: 'Banned package must not be imported',
    severity: 'error',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'banned-import', target: '*.ts', expected: match[1] ?? '', scope: 'file',
    }),
  },
  {
    id: 'structure-readme-exists',
    patterns: [
      /\bREADME\b.*\b(?:must|should|required)\b/i,
      /\b(?:must|should|required)\b.*\bREADME\b/i,
      /\binclude\s+(?:a\s+)?README\b/i,
      /\bmaintain\s+(?:a\s+)?README\b/i,
      /\bREADME\s+(?:is\s+)?required\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'A README file must exist in the project',
    severity: 'warning',
    buildPattern: () => ({
      type: 'readme-exists', target: 'README.md', expected: true, scope: 'project',
    }),
  },
  {
    id: 'structure-changelog-exists',
    patterns: [
      /\bCHANGELOG\b.*\b(?:must|should|required|exists?)\b/i,
      /\b(?:must|should|required)\b.*\bCHANGELOG\b/i,
      /\bmaintain\s+(?:a\s+)?CHANGELOG\b/i,
      /\bkeep\s+(?:a\s+)?CHANGELOG\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'A CHANGELOG file must exist in the project',
    severity: 'warning',
    buildPattern: () => ({
      type: 'changelog-exists', target: 'CHANGELOG.md', expected: true, scope: 'project',
    }),
  },
  {
    id: 'structure-formatter-config',
    patterns: [
      /\buse\s+(?:a\s+)?(?:prettier|eslint|biome|formatter)\b/i,
      /\b(?:prettier|eslint|biome)\s+(?:config|configuration)\s+(?:must|should|required)\b/i,
      /\bmust\s+have\s+(?:a\s+)?formatter\s+config/i,
      /\bformatter\s+(?:config|configuration)\s+(?:is\s+)?required\b/i,
      /\benforce\s+(?:code\s+)?formatting\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'A formatter configuration file must exist',
    severity: 'warning',
    buildPattern: () => ({
      type: 'formatter-config-exists', target: '.prettierrc', expected: true, scope: 'project',
    }),
  },
  {
    id: 'dependency-pinned-versions',
    patterns: [
      /\bpin(?:ned)?\s+dependenc(?:y|ies)\b/i,
      /\bexact\s+(?:dependency\s+)?versions?\b/i,
      /\bno\s+[\^~]\s+(?:in\s+)?(?:versions?|dependenc(?:y|ies))/i,
      /\bpin\s+(?:all\s+)?(?:dependency\s+)?versions?\b/i,
      /\bdependenc(?:y|ies)\b.*\bpinned\b/i,
      /\bno\s+(?:caret|tilde)\s+(?:in\s+)?(?:versions?|dependenc(?:y|ies))/i,
    ],
    category: 'dependency',
    verifier: 'filesystem',
    description: 'Dependencies must use pinned (exact) versions',
    severity: 'warning',
    buildPattern: () => ({
      type: 'pinned-dependencies', target: 'package.json', expected: true, scope: 'project',
    }),
  },
];
