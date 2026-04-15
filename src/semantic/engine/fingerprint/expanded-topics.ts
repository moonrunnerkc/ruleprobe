/**
 * Expanded topic definitions: 3 relocated originals + 5 new topics.
 *
 * Added to increase semantic coverage from 17.3% to 60%+.
 * Every keyword traces to a specific not-verifiable rule from the
 * 5-repo E2E audit or a corpus pattern from 72 instruction files.
 *
 * Source: ~/ruleprobe-real-test/not-verifiable-audit.md
 * Source: ~/ruleprobe-corpus/corpus-analysis.md
 */

import type { TopicDefinition } from './topic-registry.js';

/** All TypeScript/JavaScript languages for feature definitions. */
const TS_JS_LANGUAGES = ['typescript', 'tsx', 'javascript'];

/**
 * Expanded topics array: state-management, validation, logging
 * (relocated from base-topics.ts for 300-line limit compliance)
 * plus 5 new topics derived from the not-verifiable audit.
 */
export const EXPANDED_TOPICS: ReadonlyArray<TopicDefinition> = [
  {
    topic: 'state-management',
    keywords: ['state', 'store', 'context', 'reducer', 'signal'],
    nodeTypes: ['call_expression', 'function_declaration', 'arrow_function'],
    features: [
      { featureId: 'use-state', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'use-reducer', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'context-provider', query: 'call_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'store-pattern', query: 'call_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'signal-usage', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'validation',
    keywords: [
      'validation', 'schema', 'input', 'sanitize', 'type guard',
      'zod', 'io-ts', 'validated_request', 'extend_schema', 'request body',
    ],
    nodeTypes: ['call_expression', 'type_predicate', 'function_declaration'],
    features: [
      { featureId: 'schema-validation', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'type-guard', query: 'type_predicate', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'input-sanitization', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'zod-usage', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'io-ts-usage', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'logging',
    keywords: ['logging', 'log', 'structured logging', 'observability'],
    nodeTypes: ['call_expression', 'member_expression'],
    features: [
      { featureId: 'structured-log-call', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'log-level-usage', query: 'member_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'context-propagation', query: 'call_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'logger-injection', query: 'formal_parameters', extractionType: 'count', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'tooling',
    keywords: [
      'yarn', 'npm', 'pnpm', 'bun', 'cargo', 'pip', 'uv',
      'webpack', 'vite', 'esbuild', 'tsc', 'make', 'turbopack',
      'eslint', 'biome', 'ruff', 'prettier', 'black',
      'build system', 'package manager', 'compile', 'lint',
      'formatter', 'bundler', 'docker', 'ci/cd',
      'github actions', 'npm run', 'cargo test', 'cargo build',
      'just', 'flox', 'npm run compile', 'npm run build',
    ],
    nodeTypes: [
      'call_expression',
      'import_statement',
    ],
    features: [
      { featureId: 'build-script-call', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'tool-import', query: 'import_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'config-file-presence', query: 'program', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'code-style',
    keywords: [
      'early return', 'guard clause', 'reduce nesting', 'nesting depth',
      'line length', 'function size', 'single responsibility',
      'avoid mutation', 'immutable', 'ternary', 'optional chaining',
      'nullish coalescing', 'destructuring', 'spread operator',
      'no else after return', 'avoid else', 'inline variable',
      'method reference', 'closure', 'const over let', 'avoid var',
      'descriptive variable', 'composition over inheritance',
      'correctness', 'clarity', 'readability',
      'lines of code', 'loc', 'module size', 'file size',
      'format!', 'string interpolation',
    ],
    nodeTypes: [
      'if_statement',
      'return_statement',
      'ternary_expression',
      'variable_declarator',
      'arrow_function',
    ],
    features: [
      { featureId: 'early-return', query: 'return_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'ternary-usage', query: 'ternary_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'nesting-depth', query: 'if_statement', extractionType: 'depth', languages: TS_JS_LANGUAGES },
      { featureId: 'const-declarations', query: 'variable_declarator', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'optional-chain-usage', query: 'member_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'language-requirements',
    keywords: [
      'use typescript', 'typescript', 'strict mode', 'no any',
      'satisfies', 'type assertion', 'type safety', 'type checking',
      'strict null', 'result type', 'option handling',
      'no bare except', 'python', 'rust', 'go',
      'doc comment', 'docstring', 'documentation comment',
      'trait', 'interface',
    ],
    nodeTypes: [
      'type_annotation',
      'type_alias_declaration',
      'interface_declaration',
      'as_expression',
    ],
    features: [
      { featureId: 'type-annotation-count', query: 'type_annotation', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'any-type-usage', query: 'predefined_type', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'type-assertion-count', query: 'as_expression', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'interface-count', query: 'interface_declaration', extractionType: 'count', languages: ['typescript', 'tsx'] },
    ],
  },
  {
    topic: 'workflow',
    keywords: [
      'commit message', 'commit', 'pull request', 'pr title',
      'branch naming', 'review', 'ci check', 'changelog',
      'conventional commit', 'feat:', 'fix:', 'docs:',
      'agent', 'ai agent', 'do not give', 'do not explain',
      'do not repeat', 'be succinct', 'succint',
      'code review', 'approval', 'merge',
      'lsp', 'go to definition', 'find references',
    ],
    nodeTypes: [],
    features: [],
  },
  {
    topic: 'file-structure-semantic',
    keywords: [
      'co-locate test', 'colocate test', 'feature folder',
      'barrel export', 'index file', 'directory convention',
      'live in', 'entry point', 'snap.new', 'snapshot file',
    ],
    nodeTypes: [
      'export_statement',
      'import_statement',
    ],
    features: [
      { featureId: 'barrel-export-count', query: 'export_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'import-locality', query: 'import_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
];

/**
 * Number of expanded topics.
 * 3 relocated (state-management, validation, logging) + 5 new topics
 * (tooling, code-style, language-requirements, workflow, file-structure-semantic).
 */
export const EXPANDED_TOPIC_COUNT = 8;
