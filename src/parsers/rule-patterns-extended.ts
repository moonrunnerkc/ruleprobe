/**
 * Extended rule pattern dictionary.
 *
 * Contains matchers for error handling, type safety, code style,
 * testing patterns, import restrictions, and project structure
 * rules. Merged with the base matchers in rule-extractor.ts.
 */

import type { RuleMatcher } from '../types.js';

/**
 * Extended rule matchers covering code quality, testing,
 * type safety, and project configuration patterns.
 */
export const EXTENDED_RULE_MATCHERS: RuleMatcher[] = [
  {
    id: 'error-no-empty-catch',
    patterns: [
      /\bno\s+empty\s+catch\b/i,
      /\bcatch\s+blocks?\s+must\s+not\s+be\s+empty\b/i,
      /\bavoid\s+empty\s+catch\b/i,
      /\bdon'?t\s+swallow\s+(?:errors?|exceptions?)\b/i,
      /\bno\s+swallowed?\s+(?:errors?|exceptions?)\b/i,
      /\bno\s+silent\s+(?:failures?|catch)\b/i,
    ],
    category: 'error-handling',
    verifier: 'ast',
    description: 'Catch blocks must not be empty',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-empty-catch', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'type-no-enum',
    patterns: [
      /\bno\s+enums?\b/i,
      /\bdon'?t\s+use\s+enums?\b/i,
      /\bavoid\s+enums?\b/i,
      /\buse\s+union\s+types?\s+instead\s+of\s+enums?\b/i,
      /\bprefer\s+union\s+types?\s+(?:over|to)\s+enums?\b/i,
    ],
    category: 'type-safety',
    verifier: 'ast',
    description: 'Enums must not be used; prefer union types',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-enum', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'type-no-assertions',
    patterns: [
      /\bno\s+type\s+assertions?\b/i,
      /\bavoid\s+type\s+assertions?\b/i,
      /\bdon'?t\s+use\s+(?:type\s+)?as\s+(?:casts?|assertions?)\b/i,
      /\bno\s+(?:as\s+)?(?:type\s+)?cast(?:s|ing)?\b/i,
      /\bavoid\s+(?:as\s+)?(?:type\s+)?cast(?:s|ing)?\b/i,
    ],
    category: 'type-safety',
    verifier: 'ast',
    description: 'Type assertions (as casts) must not be used',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-type-assertions', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'type-no-non-null-assertions',
    patterns: [
      /\bno\s+non[\s-]null\s+assertions?\b/i,
      /\bavoid\s+non[\s-]null\s+assertions?\b/i,
      /\bdon'?t\s+use\s+(?:the\s+)?(?:non[\s-]null|!)\s+(?:operator|assertion)/i,
      /\bno\s+!\s+operator\b/i,
    ],
    category: 'type-safety',
    verifier: 'ast',
    description: 'Non-null assertions (!) must not be used',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-non-null-assertions', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'error-throw-types',
    patterns: [
      /\bthrow\s+(?:only\s+)?Error\s+objects?\b/i,
      /\bonly\s+throw\s+(?:Error|errors?)\b/i,
      /\bdon'?t\s+throw\s+(?:strings?|literals?|primitives?)\b/i,
      /\bno\s+throwing\s+(?:strings?|literals?|primitives?)\b/i,
      /\bthrow\s+new\s+Error\b.*\b(?:always|must|only)\b/i,
      /\b(?:always|must|only)\b.*\bthrow\s+new\s+Error\b/i,
    ],
    category: 'error-handling',
    verifier: 'ast',
    description: 'Only Error objects may be thrown',
    severity: 'error',
    buildPattern: () => ({
      type: 'throw-error-only', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'forbidden-no-console-extended',
    patterns: [
      /\bno\s+console\s+statements?\b/i,
      /\bno\s+console\.\*\b/i,
      /\bno\s+console\.\w+\b(?!.*\blog\b)/i,
      /\bavoid\s+(?:all\s+)?console\s+(?:calls?|methods?|statements?)\b/i,
      /\bdon'?t\s+use\s+console\b(?!\.log)/i,
    ],
    category: 'forbidden-pattern',
    verifier: 'ast',
    description: 'Console statements must not be used',
    severity: 'error',
    buildPattern: () => ({
      type: 'no-console-extended', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-no-nested-ternary',
    patterns: [
      /\bno\s+nested\s+ternar(?:y|ies)\b/i,
      /\bavoid\s+nested\s+ternar(?:y|ies)\b/i,
      /\bdon'?t\s+nest\s+ternar(?:y|ies)\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Nested ternary expressions are not allowed',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-nested-ternary', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-no-magic-numbers',
    patterns: [
      /\bno\s+magic\s+(?:numbers?|values?)\b/i,
      /\bavoid\s+magic\s+(?:numbers?|values?)\b/i,
      /\buse\s+named\s+constants?\s+(?:instead\s+of|for)\s+(?:numbers?|values?|literals?)\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Magic numbers must be replaced with named constants',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-magic-numbers', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-no-else-after-return',
    patterns: [
      /\bno\s+else\s+after\s+return\b/i,
      /\bavoid\s+else\s+after\s+return\b/i,
      /\bdon'?t\s+use\s+else\s+after\s+return\b/i,
      /\buse\s+early\s+returns?\b/i,
      /\bearly\s+returns?\s+(?:instead\s+of|over)\s+else\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Do not use else after a return statement',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-else-after-return', target: '*.ts', expected: false, scope: 'file',
    }),
  },
  {
    id: 'style-max-function-length',
    patterns: [
      /\bmax(?:imum)?\s+function\s+(?:length|lines?|size)[:\s]+(\d+)/i,
      /\bfunction(?:s)?\s+(?:must\s+)?(?:not\s+)?exceed\s+(\d+)\s+lines?\b/i,
      /\bfunction\s+length[:\s]+(?:max(?:imum)?\s+)?(\d+)/i,
      /\b(\d+)\s+lines?\s+(?:max(?:imum)?\s+)?(?:per\s+)?function\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Functions must not exceed the maximum line count',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'max-function-length', target: '*.ts', expected: match[1] ?? '50', scope: 'file',
    }),
  },
  {
    id: 'style-max-params',
    patterns: [
      /\bmax(?:imum)?\s+(?:function\s+)?param(?:eter)?s?[:\s]+(\d+)/i,
      /\bno\s+more\s+than\s+(\d+)\s+param(?:eter)?s?\b/i,
      /\bparam(?:eter)?s?\s+(?:max(?:imum)?|limit)[:\s]+(\d+)/i,
      /\b(\d+)\s+param(?:eter)?s?\s+max(?:imum)?\b/i,
    ],
    category: 'code-style',
    verifier: 'ast',
    description: 'Functions must not have too many parameters',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'max-params', target: '*.ts', expected: match[1] ?? '4', scope: 'file',
    }),
  },
];
