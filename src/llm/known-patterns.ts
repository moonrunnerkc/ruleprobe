/**
 * Single source of truth for the pattern types LLM prompts may reference.
 *
 * Both the LLM extraction pipeline and the rubric decomposition
 * pipeline send this list to the model so it knows which checks the
 * project can actually verify. Previously each pipeline kept its own
 * private list, and the two drifted; the rubric list carried type-aware
 * and tree-sitter entries that the extraction list did not. Keep this
 * file in sync with the verifier switch statements in
 * src/verifier/ast-verifier.ts, src/verifier/regex-verifier.ts, and
 * src/verifier/file-verifier.ts.
 */

/** Pattern types verified by the AST verifier (ts-morph). */
const AST_PATTERN_TYPES = [
  'camelCase', 'PascalCase', 'no-any', 'no-console-log', 'named-exports',
  'jsdoc-public', 'no-path-aliases', 'no-deep-relative-imports',
  'no-empty-catch', 'no-enum', 'no-type-assertions', 'no-non-null-assertions',
  'throw-error-only', 'no-console-extended', 'no-nested-ternary',
  'no-magic-numbers', 'no-else-after-return', 'max-function-length',
  'max-params', 'no-namespace-imports', 'no-barrel-files', 'no-settimeout-in-tests',
  'no-var', 'prefer-const', 'no-wildcard-exports',
] as const;

/** Pattern types verified by the regex verifier. */
const REGEX_PATTERN_TYPES = [
  'line-length', 'no-ts-directives', 'no-test-only', 'no-test-skip',
  'quote-style', 'banned-import', 'no-todo-comments', 'consistent-semicolons',
] as const;

/** Pattern types verified by the filesystem verifier. */
const FILESYSTEM_PATTERN_TYPES = [
  'kebab-case', 'test-files-exist', 'max-file-length', 'test-file-naming',
  'strict-mode', 'file-exists', 'formatter-config', 'pinned-dependencies',
] as const;

/** Pattern types verified by the type-aware checks. */
const TYPE_AWARE_PATTERN_TYPES = [
  'no-implicit-any', 'no-unused-exports', 'no-unresolved-imports',
] as const;

/** Pattern types verified by the tree-sitter verifier. */
const TREE_SITTER_PATTERN_TYPES = [
  'python-snake-case', 'python-class-naming', 'go-naming', 'function-length',
] as const;

/**
 * The full set of known pattern types passed to LLM prompts.
 *
 * Spans AST, regex, filesystem, type-aware, and tree-sitter checks.
 * Used by both the extraction and rubric decomposition pipelines so
 * the model is told the same surface in either path.
 */
export const KNOWN_PATTERN_TYPES: string[] = [
  ...AST_PATTERN_TYPES,
  ...REGEX_PATTERN_TYPES,
  ...FILESYSTEM_PATTERN_TYPES,
  ...TYPE_AWARE_PATTERN_TYPES,
  ...TREE_SITTER_PATTERN_TYPES,
];
