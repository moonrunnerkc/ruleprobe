/**
 * Rule pattern matchers that emit tree-sitter rules.
 *
 * Recognizes instruction phrasings about Python and Go conventions
 * and routes them through the tree-sitter verifier so non-TS/JS
 * languages get real AST evidence rather than regex/filesystem
 * approximations.
 */

import type { RuleMatcher } from '../types.js';

/** Default function-length cap when an instruction does not specify one. */
const DEFAULT_FUNCTION_LENGTH = '50';

/** Matchers that produce tree-sitter rules. Checked alongside the other matcher tables. */
export const TREESITTER_RULE_MATCHERS: RuleMatcher[] = [
  {
    id: 'naming-python-snake-case',
    patterns: [
      /\bpython\b.*\bsnake[_\s-]*case\b.*\bfunction/i,
      /\bsnake[_\s-]*case\b.*\bpython\b.*\bfunction/i,
      /\bpython\s+function\s+names?:?\s+snake[_\s-]*case\b/i,
      /\buse\s+snake[_\s-]*case\s+for\s+python\s+functions?\b/i,
    ],
    category: 'naming',
    verifier: 'treesitter',
    description: 'Python function names must use snake_case',
    severity: 'error',
    buildPattern: () => ({
      type: 'python-snake-case', target: '*.py', expected: 'snake_case', scope: 'file',
    }),
  },
  {
    id: 'naming-python-class',
    patterns: [
      /\bpython\b.*\bclass(?:es)?\b.*\bPascal\s*Case\b/i,
      /\bPascal\s*Case\b.*\bpython\b.*\bclass(?:es)?\b/i,
      /\bpython\s+class\s+names?:?\s+Pascal\s*Case\b/i,
    ],
    category: 'naming',
    verifier: 'treesitter',
    description: 'Python class names must use PascalCase',
    severity: 'error',
    buildPattern: () => ({
      type: 'python-class-naming', target: '*.py', expected: 'PascalCase', scope: 'file',
    }),
  },
  {
    id: 'naming-go-conventions',
    patterns: [
      /\bgo\b.*\bexported\b.*\bPascal\s*Case\b/i,
      /\bgo\b.*\bunexported\b.*\bcamel\s*Case\b/i,
      /\bgo\s+function\s+names?:?\s+(Pascal|camel)\s*Case\b/i,
      /\buse\s+Pascal\s*Case\s+for\s+exported\s+go\s+functions?\b/i,
    ],
    category: 'naming',
    verifier: 'treesitter',
    description: 'Go function names follow exported/unexported visibility (PascalCase / camelCase)',
    severity: 'error',
    buildPattern: () => ({
      type: 'go-naming', target: '*.go', expected: 'PascalCase|camelCase', scope: 'file',
    }),
  },
  {
    id: 'style-python-function-length',
    patterns: [
      /\bpython\s+functions?\s+(?:must|should)\s+(?:be|stay)\s+under\s+(\d+)\s+lines?\b/i,
      /\bmax(?:imum)?\s+python\s+function\s+length:?\s+(\d+)\s+lines?\b/i,
    ],
    category: 'code-style',
    verifier: 'treesitter',
    description: 'Python function length must stay under the specified limit',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'function-length',
      target: '*.py',
      expected: match[1] ?? DEFAULT_FUNCTION_LENGTH,
      scope: 'file',
    }),
  },
  {
    id: 'style-go-function-length',
    patterns: [
      /\bgo\s+functions?\s+(?:must|should)\s+(?:be|stay)\s+under\s+(\d+)\s+lines?\b/i,
      /\bmax(?:imum)?\s+go\s+function\s+length:?\s+(\d+)\s+lines?\b/i,
    ],
    category: 'code-style',
    verifier: 'treesitter',
    description: 'Go function length must stay under the specified limit',
    severity: 'warning',
    buildPattern: (_line: string, match: RegExpMatchArray) => ({
      type: 'function-length',
      target: '*.go',
      expected: match[1] ?? DEFAULT_FUNCTION_LENGTH,
      scope: 'file',
    }),
  },
];
