/**
 * Rule pattern dictionary.
 *
 * Defines all recognizable rule types with keyword patterns, categories,
 * verifier assignments, and verification pattern factories. Adding a new
 * rule type means adding an entry here; no changes to the extraction
 * orchestrator are needed.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Dictionary of known rule matchers, checked in order.
 * Each matcher covers varied phrasings of the same underlying rule.
 */
export const RULE_MATCHERS: RuleMatcher[] = [
  {
    id: 'naming-camelcase-variables',
    patterns: [
      /\bcamel\s*case\b.*\b(variable|function|method|property|param)/i,
      /\b(variable|function|method|property|param)\w*\b.*\bcamel\s*case\b/i,
      /\bcamel\s*case\s+(for\s+)?(all\s+)?(variable|function|method)/i,
      /\b(variable|function)\s+names?:?\s*camel\s*case\b/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Variables and functions must use camelCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'camelCase', target: 'variables', expected: 'camelCase', scope: 'file',
    }),
  },
  {
    id: 'naming-camelcase-general',
    patterns: [
      /\bcamel\s*case\b(?!.*\b(files?|types?|interfaces?|class(?:es)?|components?|PascalCase|variables?|functions?|methods?|propert(?:y|ies)|params?)\b)/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Identifiers must use camelCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'camelCase', target: 'identifiers', expected: 'camelCase', scope: 'file',
    }),
  },
  {
    id: 'naming-pascalcase-types',
    patterns: [
      /\bPascal\s*Case\b.*\b(type|interface|class|component|enum)/i,
      /\b(type|interface|class|component|enum)\w*\b.*\bPascal\s*Case\b/i,
      /\bPascal\s*Case\s+(for\s+)?(all\s+)?(type|interface|class|component)/i,
      /\b(type|interface|class)\s+names?:?\s*Pascal\s*Case\b/i,
    ],
    category: 'naming',
    verifier: 'ast',
    description: 'Types, interfaces, and classes must use PascalCase naming',
    severity: 'error',
    buildPattern: () => ({
      type: 'PascalCase', target: 'types', expected: 'PascalCase', scope: 'file',
    }),
  },
  {
    id: 'naming-kebab-case-files',
    patterns: [
      /\bkebab[\s-]*case\b.*\bfile/i,
      /\bfile\s+names?:?\s*kebab[\s-]*case\b/i,
      /\bfile\b.*\bkebab[\s-]*case\b/i,
      /\bkebab[\s-]*case\b.*\bnamed?\b/i,
    ],
    category: 'naming',
    verifier: 'filesystem',
    description: 'File names must use kebab-case',
    severity: 'error',
    buildPattern: () => ({
      type: 'kebab-case', target: 'filenames', expected: 'kebab-case', scope: 'project',
    }),
  },
  {
    id: 'forbidden-no-any-type',
    patterns: [
      /\bno\s+any\s+type/i,
      /\bnever\s+use\s+any\b/i,
      /\bavoid\s+any\s+type/i,
      /\bno\s+`?any`?\s+type/i,
      /\bdon'?t\s+use\s+any\b(?!\s+(?:of|other|more))/i,
      /\bwithout\s+any\s+type/i,
      /\bno\s+any\b(?=.*\btype)/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'The "any" type must not be used',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-any', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'forbidden-no-console-log',
    patterns: [
      /\bno\s+console\.?log\b/i,
      /\bnever\s+use\s+console\.?log\b/i,
      /\bavoid\s+console\.?log\b/i,
      /\bdon'?t\s+use\s+console\.?log\b/i,
      /\bno\s+console\.\s*log\b.*\bproduction\b/i,
      /\bconsole\.?log\b.*\bforbidden\b/i,
      /\bconsole\.?log\b.*\bnot\s+allowed\b/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'console.log must not be used in production code',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-console-log', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'structure-named-exports-only',
    patterns: [
      /\bnamed\s+exports?\s+only\b/i,
      /\bno\s+default\s+exports?\b/i,
      /\bnever\s+use\s+default\s+exports?\b/i,
      /\bavoid\s+default\s+exports?\b/i,
      /\bdon'?t\s+use\s+default\s+exports?\b/i,
      /\buse\s+named\s+exports?\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Only named exports are allowed, no default exports',
    severity: 'error',
    buildPattern: () => ({
      type: 'named-exports-only', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'structure-max-line-length',
    patterns: [
      /\bmax(?:imum)?\s+(?:line\s+)?length[:\s]+(\d+)/i,
      /\bline\s+length[:\s]+(?:max(?:imum)?\s+)?(\d+)/i,
      /\b(\d+)\s+(?:character|char|col(?:umn)?)\s+(?:line\s+)?(?:limit|max|length)/i,
      /\blines?\s+(?:should|must)\s+(?:not\s+)?(?:exceed|be\s+(?:longer|more)\s+than)\s+(\d+)/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'regex',
    description: 'Lines must not exceed the maximum length',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'max-line-length', target: '*.ts', expected: match[1] ?? '120', scope: 'file',
    }),
  },
  {
    id: 'structure-max-file-length',
    patterns: [
      /\bmax(?:imum)?\s+file\s+length[:\s]+(\d+)/i,
      /\bfile\s+length[:\s]+(?:max(?:imum)?\s+)?(\d+)/i,
      /\bfiles?\s+(?:should|must)\s+(?:not\s+)?(?:exceed|be\s+(?:longer|more)\s+than)\s+(\d+)\s+lines/i,
      /\b(\d+)\s+lines?\b.*\bmax(?:imum)?\s+file\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'Files must not exceed the maximum line count',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'max-file-length', target: '*.ts', expected: match[1] ?? '300', scope: 'file',
    }),
  },
  {
    id: 'test-files-exist',
    patterns: [
      /\ball\s+files?\s+must\s+have\s+tests?\b/i,
      /\btest\s+files?\s+(for\s+)?(every|each|all)\b/i,
      /\bevery\s+(?:source\s+)?file\s+(?:must\s+|should\s+)?have\s+(?:a\s+)?(?:corresponding\s+)?test/i,
      /\bco[\s-]?located\b.*\btests?\b/i,
      /\btests?\b.*\bco[\s-]?located\b/i,
      /\btest\s+files?:?\s+co[\s-]?located\b/i,
    ],
    category: 'test-requirement',
    verifier: 'filesystem',
    description: 'Every source file must have a corresponding test file',
    severity: 'error',
    buildPattern: () => ({
      type: 'test-files-exist', target: 'src/**/*.ts', expected: true, scope: 'project',
    }),
  },
  {
    id: 'test-named-pattern',
    patterns: [
      /\btest\s+files?\b.*\bnamed\b.*\b\.test\.ts\b/i,
      /\bnamed\b.*\*\.test\.ts\b/i,
      /\b\.test\.ts\b.*\btest\s+files?\b/i,
    ],
    category: 'test-requirement',
    verifier: 'filesystem',
    description: 'Test files must be named *.test.ts',
    severity: 'error',
    buildPattern: () => ({
      type: 'test-file-naming', target: 'tests/**', expected: '*.test.ts', scope: 'project',
    }),
  },
  {
    id: 'import-no-deep-relative',
    patterns: [
      /\bno\s+(?:deep\s+)?relative\s+imports?\s+deeper\s+than\s+(\d+)/i,
      /\brelative\s+imports?\b.*\bno\s+(?:more|deeper)\s+than\s+(\d+)/i,
      /\bno\s+deep\s+relative\s+imports?\b/i,
      /\bavoid\s+deep\s+relative\s+imports?\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'Relative imports must not go too deep',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'no-deep-relative-imports', target: '*.ts', expected: match[1] ?? '2', scope: 'file',
    }),
  },
  {
    id: 'import-no-path-aliases',
    patterns: [
      /\buse\s+(?:relative\s+)?path(?:s)?\b.*\bno\s+(?:path\s+)?aliases\b/i,
      /\bno\s+path\s+aliases\b/i,
      /\bimports?\s+use\s+relative\s+paths?\b/i,
    ],
    category: 'import-pattern',
    verifier: 'ast',
    description: 'Imports must use relative paths, not path aliases',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-path-aliases', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'structure-jsdoc-required',
    patterns: [
      /\bevery\s+(?:public\s+)?function\s+(?:must\s+|should\s+)?ha(?:ve|s)\s+(?:a\s+)?JSDoc\b/i,
      /\bJSDoc\b.*\b(?:required|mandatory)\b/i,
      /\b(?:required|mandatory)\b.*\bJSDoc\b/i,
      /\bJSDoc\s+comment\b.*\bevery\b/i,
      /\ball\s+(?:public\s+)?functions?\s+(?:need|require)\s+JSDoc\b/i,
    ],
    category: 'structure',
    verifier: 'ast',
    description: 'Every public function must have a JSDoc comment',
    severity: 'warning',
    buildPattern: () => ({
      type: 'jsdoc-required', target: '*.ts', expected: true, scope: 'file',
    }),
  },
  {
    id: 'structure-strict-mode',
    patterns: [
      /\bTypeScript\s+strict\s+mode\b/i,
      /\bstrict\s+mode\b.*\bTypeScript\b/i,
      /\btsconfig\b.*\bstrict\b/i,
      /\bstrict:\s*true\b/i,
    ],
    category: 'structure',
    verifier: 'filesystem',
    description: 'TypeScript strict mode must be enabled',
    severity: 'error',
    buildPattern: () => ({
      type: 'strict-mode', target: 'tsconfig.json', expected: true, scope: 'project',
    }),
  },
];
