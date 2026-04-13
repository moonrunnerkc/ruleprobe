/**
 * File structure rule matchers.
 *
 * Matches instructions about directory structure, path existence,
 * and file organization patterns. Examples:
 * - "Tests go in __tests__/"
 * - "Components live in src/components/"
 * - "Every module needs an index.ts"
 */

import type { RuleMatcher } from '../types.js';

/**
 * Matchers for file structure rules.
 */
export const FILE_STRUCTURE_MATCHERS: RuleMatcher[] = [
  {
    id: 'file-structure-tests-dir',
    patterns: [
      /\btests?\s+(?:go|live|belong|placed?|should\s+be)\s+in\s+(\S+)/i,
      /\btest\s+files?\s+(?:in|under)\s+(\S+)/i,
      /\b(?:put|place|keep)\s+tests?\s+(?:in|under)\s+(\S+)/i,
      /\b__tests__\s*\//i,
      /\btests?\s+director(?:y|ies)\b/i,
    ],
    category: 'file-structure',
    verifier: 'filesystem',
    description: 'Test files must be in the specified directory',
    severity: 'warning',
    buildPattern: (line, match) => {
      const dir = match[1]?.replace(/['"`,]/g, '') ?? '__tests__';
      return {
        type: 'directory-exists-with-files',
        target: dir,
        expected: true,
        scope: 'project',
      };
    },
  },
  {
    id: 'file-structure-components-dir',
    patterns: [
      /\bcomponents?\s+(?:go|live|belong|placed?|should\s+be)\s+in\s+(\S+)/i,
      /\bcomponents?\s+(?:in|under)\s+src\/components?\b/i,
      /\b(?:put|place|keep)\s+components?\s+(?:in|under)\s+(\S+)/i,
    ],
    category: 'file-structure',
    verifier: 'filesystem',
    description: 'Components must be in the specified directory',
    severity: 'warning',
    buildPattern: (line, match) => {
      const dir = match[1]?.replace(/['"`,]/g, '') ?? 'src/components';
      return {
        type: 'directory-exists-with-files',
        target: dir,
        expected: true,
        scope: 'project',
      };
    },
  },
  {
    id: 'file-structure-env-file',
    patterns: [
      /\buse\s+\.env(?:\.local)?\b/i,
      /\b\.env\.local\b.*\bfor\b.*\b(?:local|dev)\b/i,
      /\blocal\s+config\b.*\b\.env\b/i,
      /\b\.env\b.*\blocal\s+(?:config|settings?|environment)\b/i,
    ],
    category: 'file-structure',
    verifier: 'filesystem',
    description: 'Environment file must exist for local configuration',
    severity: 'warning',
    confidence: 'medium',
    buildPattern: (line) => {
      const envFile = line.includes('.env.local') ? '.env.local' : '.env';
      return {
        type: 'file-pattern-exists',
        target: envFile,
        expected: true,
        scope: 'project',
      };
    },
  },
  {
    id: 'file-structure-module-index',
    patterns: [
      /\bevery\s+module\s+(?:needs?|requires?|must\s+have)\s+(?:an?\s+)?index\.\w+/i,
      /\ball\s+modules?\s+(?:should|must)\s+have\s+(?:an?\s+)?index\.\w+/i,
      /\bindex\.(?:ts|js)\s+(?:in\s+)?every\s+(?:module|directory|folder)\b/i,
      /\beach\s+(?:module|directory|folder)\s+(?:needs?|requires?|must\s+have)\s+index/i,
    ],
    category: 'file-structure',
    verifier: 'filesystem',
    description: 'Every module directory must have an index file',
    severity: 'warning',
    buildPattern: (line) => {
      const ext = line.match(/index\.(\w+)/)?.[1] ?? 'ts';
      return {
        type: 'module-index-required',
        target: `index.${ext}`,
        expected: true,
        scope: 'project',
      };
    },
  },
  {
    id: 'file-structure-src-dir',
    patterns: [
      /\bsource\s+(?:code|files?)\s+(?:in|under)\s+src\//i,
      /\bsrc\/\s+director/i,
      /\b(?:put|place|keep)\s+(?:source|code)\s+(?:in|under)\s+src\//i,
    ],
    category: 'file-structure',
    verifier: 'filesystem',
    description: 'Source code must be in src/ directory',
    severity: 'warning',
    buildPattern: () => ({
      type: 'directory-exists-with-files',
      target: 'src',
      expected: true,
      scope: 'project',
    }),
  },
];
