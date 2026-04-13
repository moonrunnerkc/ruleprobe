/**
 * Testing pattern rule matchers.
 *
 * Matches instructions about test colocation, test structure,
 * and test organization patterns. Examples:
 * - "Colocate tests with source files"
 * - "Use describe/it blocks"
 * - "Each component should have a test file"
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers for testing organization and structure rules.
 */
export const TESTING_MATCHERS: RuleMatcher[] = [
  {
    id: 'testing-colocate-tests',
    patterns: [
      /\bcolocat(?:e|ed|ion)\b.*\btests?\b/i,
      /\btests?\b.*\bcolocat(?:e|ed|ion)\b/i,
      /\btests?\s+(?:next\s+to|beside|alongside)\s+(?:source|src|code)\b/i,
      /\btest\s+files?\s+(?:in|next\s+to)\s+(?:the\s+)?same\s+(?:directory|folder)\b/i,
      /\beach\s+(?:file|module|component)\s+(?:should|must)\s+have\s+(?:a\s+)?test\b/i,
    ],
    category: 'testing',
    verifier: 'filesystem',
    description: 'Test files must be colocated with their source files',
    severity: 'warning',
    buildPattern: () => ({
      type: 'test-colocation',
      target: '*.test.ts',
      expected: true,
      scope: 'project',
    }),
  },
  {
    id: 'testing-describe-it-blocks',
    patterns: [
      /\buse\s+describe\s*\/?\s*it\s+blocks?\b/i,
      /\borganize\s+tests?\s+(?:with|using|in)\s+describe\b/i,
      /\bdescribe\s+blocks?\s+for\s+(?:each|every)\b/i,
      /\bgroup\s+tests?\s+(?:with|using|in)\s+describe\b/i,
      /\bnested\s+describe\s+blocks?\b/i,
    ],
    category: 'testing',
    verifier: 'regex',
    description: 'Test files must use describe/it block structure',
    severity: 'warning',
    buildPattern: () => ({
      type: 'describe-it-structure',
      target: '*.test.ts',
      expected: true,
      scope: 'file',
    }),
  },
  {
    id: 'testing-no-console-in-tests',
    patterns: [
      /\bno\s+console\.\w+\s+in\s+tests?\b/i,
      /\bavoid\s+console\b.*\btest\s+files?\b/i,
      /\bdon'?t\s+use\s+console\b.*\btests?\b/i,
      /\bremove\s+console\b.*\btests?\b/i,
    ],
    category: 'testing',
    verifier: 'regex',
    description: 'Console statements must not appear in test files',
    severity: 'warning',
    buildPattern: () => ({
      type: 'no-console-in-tests',
      target: '*.test.ts',
      expected: false,
      scope: 'file',
    }),
  },
];
