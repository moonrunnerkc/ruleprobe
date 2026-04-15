/**
 * Base taxonomy data for ASPE pattern topics.
 *
 * Contains the original 10 base topic definitions with keyword mappings,
 * relevant AST node types, and feature definitions. Combined with
 * expanded topics from expanded-topics.ts for the full taxonomy.
 */

import type { TopicDefinition } from './topic-registry.js';
import { EXPANDED_TOPICS, EXPANDED_TOPIC_COUNT } from './expanded-topics.js';

/** All TypeScript/JavaScript languages for feature definitions. */
const TS_JS_LANGUAGES = ['typescript', 'tsx', 'javascript'];

/**
 * Original 10 pattern topics with expanded keywords.
 *
 * Each topic has keywords for rule-text matching, relevant AST node types,
 * and feature definitions with queries for structural measurement.
 */
const ORIGINAL_TOPICS: ReadonlyArray<TopicDefinition> = [
  {
    topic: 'error-handling',
    keywords: [
      'error handling',
      'error pattern',
      'exception',
      'try/catch',
      'error boundary',
      'handle errors',
      'propagate error',
      'error propagation',
      'unwrap()',
      'panic',
      'throw error',
      'catch error',
      'error class',
      'stack trace',
      'discard error',
      'fallible',
    ],
    nodeTypes: [
      'try_statement',
      'catch_clause',
      'throw_statement',
      'new_expression',
    ],
    features: [
      { featureId: 'custom-error-class', query: 'class_declaration', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'try-catch-typed', query: 'catch_clause', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'try-catch-bare', query: 'catch_clause', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'error-rethrow', query: 'throw_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'error-log-before-rethrow', query: 'try_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'dot-catch-chain', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'result-type-return', query: 'return_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'error-boundary-component', query: 'class_declaration', extractionType: 'signature', languages: ['tsx'] },
    ],
  },
  {
    topic: 'component-structure',
    keywords: [
      'component',
      'functional component',
      'class component',
      'hooks',
      'composition',
      'react component',
      'jsx',
      'tsx',
      'render',
      'props',
      'children',
      'forward ref',
      'forwardref',
    ],
    nodeTypes: [
      'function_declaration',
      'arrow_function',
      'class_declaration',
      'call_expression',
    ],
    features: [
      { featureId: 'functional-component', query: 'function_declaration', extractionType: 'count', languages: ['tsx'] },
      { featureId: 'class-component', query: 'class_declaration', extractionType: 'count', languages: ['tsx'] },
      { featureId: 'hooks-usage', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'prop-destructuring', query: 'object_pattern', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'prop-interface', query: 'interface_declaration', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'forward-ref', query: 'call_expression', extractionType: 'signature', languages: ['tsx'] },
      { featureId: 'compound-component', query: 'assignment_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'render-prop', query: 'arrow_function', extractionType: 'signature', languages: ['tsx'] },
    ],
  },
  {
    topic: 'data-fetching',
    keywords: [
      'data fetching',
      'api calls',
      'fetch',
      'query',
      'loader',
      'axios',
      'react-query',
      'swr',
      'graphql',
      'server action',
      'api route',
    ],
    nodeTypes: [
      'call_expression',
      'await_expression',
      'function_declaration',
    ],
    features: [
      { featureId: 'fetch-api', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'axios-call', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'react-query-hook', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'swr-hook', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'server-action', query: 'function_declaration', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'loader-function', query: 'export_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'api-route-handler', query: 'export_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'file-organization',
    keywords: [
      'file structure',
      'folder structure',
      'organization',
      'barrel',
      'colocation',
      'co-locate',
      'colocate',
      'entry point',
      'directory',
      'file path',
      'module path',
      'feature folder',
      'layout',
      'mod.rs',
      'import order',
      'import organization',
    ],
    nodeTypes: [
      'export_statement',
      'import_statement',
    ],
    features: [
      { featureId: 'barrel-export', query: 'export_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'colocated-test', query: 'import_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'colocated-style', query: 'import_statement', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'feature-folder', query: 'import_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'layer-separation', query: 'import_statement', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'testing-patterns',
    keywords: [
      'testing',
      'test pattern',
      'test structure',
      'describe/it',
      'arrange-act-assert',
      'test',
      'tests',
      'assert',
      'assertion',
      'assertions',
      'test runner',
      'unit test',
      'integration test',
      'snapshot',
      'mock',
      'vitest',
      'jest',
      'pytest',
    ],
    nodeTypes: [
      'call_expression',
      'function_declaration',
      'arrow_function',
    ],
    features: [
      { featureId: 'describe-it-blocks', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'test-function', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'arrange-act-assert', query: 'call_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'factory-function', query: 'function_declaration', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'before-after-hooks', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'mock-usage', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'snapshot-test', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'naming-conventions',
    keywords: [
      'naming',
      'convention',
      'prefix',
      'suffix',
      'semantic naming',
      'camelcase',
      'camel case',
      'pascalcase',
      'pascal case',
      'snake_case',
      'snake case',
      'screaming_snake',
      'upper_case',
      'upper case',
      'all_caps',
      'kebab-case',
      'kebab case',
      'lowercase',
      'uppercase',
      'casing',
      'variables',
      'constants',
      'identifiers',
    ],
    nodeTypes: [
      'function_declaration',
      'variable_declarator',
      'type_alias_declaration',
    ],
    features: [
      { featureId: 'component-prefix', query: 'function_declaration', extractionType: 'count', languages: ['tsx'] },
      { featureId: 'hook-prefix', query: 'function_declaration', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'type-suffix', query: 'type_alias_declaration', extractionType: 'count', languages: ['typescript', 'tsx'] },
      { featureId: 'constant-casing', query: 'variable_declarator', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'file-name-pattern', query: 'program', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
  {
    topic: 'api-patterns',
    keywords: [
      'api',
      'rest',
      'endpoint',
      'route',
      'handler',
      'middleware',
      'grpc',
      'protobuf',
      'protocol',
      'request/response',
      'api view',
    ],
    nodeTypes: [
      'call_expression',
      'function_declaration',
      'arrow_function',
      'export_statement',
    ],
    features: [
      { featureId: 'rest-route-structure', query: 'call_expression', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'middleware-chain', query: 'call_expression', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'controller-pattern', query: 'class_declaration', extractionType: 'signature', languages: TS_JS_LANGUAGES },
      { featureId: 'dto-validation', query: 'class_declaration', extractionType: 'count', languages: TS_JS_LANGUAGES },
      { featureId: 'response-shape', query: 'object', extractionType: 'signature', languages: TS_JS_LANGUAGES },
    ],
  },
];

/**
 * Complete base taxonomy: 7 original topics + 8 expanded/new topics.
 *
 * Combined array used by the TopicRegistry. Total: 15 topics.
 */
export const BASE_TOPICS: ReadonlyArray<TopicDefinition> = [
  ...ORIGINAL_TOPICS,
  ...EXPANDED_TOPICS,
];

/**
 * Number of base topics in the taxonomy.
 *
 * Updated from 10 to 15 after adding tooling, code-style,
 * language-requirements, workflow, and file-structure-semantic topics.
 * Source: not-verifiable audit of 43/52 rules from 5-repo E2E run.
 */
export const BASE_TOPIC_COUNT = 15;
