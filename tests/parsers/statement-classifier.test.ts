/**
 * Tests for Pass 2: Statement classification.
 *
 * Validates keyword-driven classification against real statements
 * from the 72-file corpus. Critical negative tests ensure context
 * statements are not classified as actionable.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyStatement,
  classifyCodeBlock,
} from '../../src/parsers/statement-classifier.js';

/**
 * Helper: classify a bullet-type statement.
 */
function classify(text: string, section: string = ''): {
  category: string;
  confidence: number;
} {
  return classifyStatement(text, 'bullet', section, '');
}

// -----------------------------------------------------------------------
// IMPERATIVE_DIRECT (difficulty 1)
// -----------------------------------------------------------------------
describe('classifies IMPERATIVE_DIRECT', () => {
  const examples = [
    'Use TypeScript for all new code',
    'Ensure all tests pass before merging',
    'All commit messages and PR titles MUST be prefixed with [AI]',
    'Keep commits small and focused',
    'Handle errors appropriately',
    'Never silently discard errors with let _ =',
    'Do not include unrelated changes in a PR',
    'Include Microsoft copyright header in all files',
    'Remove temporary files at the end of the task',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('IMPERATIVE_DIRECT');
    });
  }
});

// -----------------------------------------------------------------------
// TOOLING_COMMAND (difficulty 1)
// -----------------------------------------------------------------------
describe('classifies TOOLING_COMMAND', () => {
  const examples = [
    'Use `yarn test:update` before committing',
    'Run `pnpm --filter=next build` to build',
    '**Build System**: Yarn 4 workspaces (monorepo)',
    'Use `yarn workspace <workspace-name> run <command>` for workspace tasks',
    'Run `make lint` before submitting',
    'Use `golangci-lint` for linting',
    'Install with `npm i -g corepack && yarn`',
    'Run all tests with `npx vitest`',
    '**Linting**: eslint with auto-fix',
    'Use `npx jest path/to/test.test.ts` for testing',
    'Run yarn typecheck before committing',
    'Always run yarn commands from the root directory',
    'NEVER run bare tsc',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('TOOLING_COMMAND');
    });
  }
});

describe('classifies TOOLING_COMMAND code blocks', () => {
  it('classifies bash code block with CLI tools', () => {
    const result = classifyCodeBlock(
      'yarn test:typecheck\nyarn test:update\nyarn fix\n',
      'bash',
      'Development Commands',
    );
    expect(result.category).toBe('TOOLING_COMMAND');
  });

  it('classifies shell prompt code block', () => {
    const result = classifyCodeBlock(
      '$ npm install\n$ npm run build\n',
      '',
      '',
    );
    expect(result.category).toBe('TOOLING_COMMAND');
  });
});

// -----------------------------------------------------------------------
// PREFER_PATTERN (difficulty 1)
// -----------------------------------------------------------------------
describe('classifies PREFER_PATTERN', () => {
  const examples = [
    'Prefer const over let',
    'Use async/await instead of Promise.then calls',
    'Prefer functional components over class components',
    'Favor arrow functions over anonymous function expressions',
    'Use template literals rather than string concatenation',
    'Prefer named exports over default exports',
    'Avoid bind(), use arrow functions instead of anonymous calls',
    'Use optional chaining instead of manual null checks',
    'Prefer composable functions over class hierarchies',
    'Use in top-level scopes export function x instead of export const x',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('PREFER_PATTERN');
    });
  }
});

// -----------------------------------------------------------------------
// NAMING_CONVENTION (difficulty 1)
// -----------------------------------------------------------------------
describe('classifies NAMING_CONVENTION', () => {
  const examples = [
    'Use PascalCase for type names',
    'Use camelCase for function and method names',
    'Use PascalCase for enum values',
    'kebab-case for file names',
    'Prefix hooks with use',
    'SCREAMING_SNAKE_CASE for constants',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('NAMING_CONVENTION');
    });
  }
});

// -----------------------------------------------------------------------
// IMPERATIVE_QUALIFIED (difficulty 2)
// -----------------------------------------------------------------------
describe('classifies IMPERATIVE_QUALIFIED', () => {
  const examples = [
    'You should generally prefer functional components',
    'When possible, reuse existing utility functions',
    'Tests should attempt to mirror realistic data',
    'Consider using composition for complex state',
    'Use whole words in names when possible',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('IMPERATIVE_QUALIFIED');
    });
  }
});

// -----------------------------------------------------------------------
// FILE_STRUCTURE (difficulty 2)
// -----------------------------------------------------------------------
describe('classifies FILE_STRUCTURE', () => {
  const examples = [
    'Place tests in `tests/` alongside source files',
    'Tests live in `src/vs/*/test/` folders',
    'Co-locate test files with source files',
    '*.test.ts files go alongside source',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(['FILE_STRUCTURE', 'TOOLING_COMMAND', 'IMPERATIVE_DIRECT']).toContain(
        result.category,
      );
    });
  }
});

// -----------------------------------------------------------------------
// WORKFLOW (difficulty 2)
// -----------------------------------------------------------------------
describe('classifies WORKFLOW', () => {
  const examples = [
    'Sign off every commit with git commit -s',
    'Create a PR with the fix and reference the issue',
    'Each commit must compile and pass tests independently',
    'Submit all PRs against the main branch',
    'PR titles must follow area: short description format',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(['WORKFLOW', 'IMPERATIVE_DIRECT']).toContain(result.category);
    });
  }
});

// -----------------------------------------------------------------------
// CODE_STYLE (difficulty 2)
// -----------------------------------------------------------------------
describe('classifies CODE_STYLE', () => {
  const examples = [
    'Keep functions under 50 lines',
    'Maximum 300 lines per file',
    'Use early returns to avoid nesting',
    'Single responsibility per function',
    'No more than 4 parameters per function',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(['CODE_STYLE', 'IMPERATIVE_DIRECT']).toContain(result.category);
    });
  }
});

// -----------------------------------------------------------------------
// PATTERN_REFERENCE (difficulty 3)
// -----------------------------------------------------------------------
describe('classifies PATTERN_REFERENCE', () => {
  const examples = [
    'Follow existing patterns in the codebase',
    'Match existing test structure before creating new ones',
    'Use the same approach as other controllers',
    'Look for existing utility functions before implementing new ones',
    'Be consistent with existing code style',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('PATTERN_REFERENCE');
    });
  }
});

// -----------------------------------------------------------------------
// LANGUAGE_SPECIFIC (difficulty 3)
// -----------------------------------------------------------------------
describe('classifies LANGUAGE_SPECIFIC', () => {
  const examples = [
    'Avoid using functions that panic like unwrap(), use ? to propagate errors',
    'Do not use any or unknown as the type for variables',
    'Use .log_err() when you need to ignore errors but want visibility',
    'Propagate errors with ? when the calling function should handle them',
  ];

  for (const ex of examples) {
    it(`classifies: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(['LANGUAGE_SPECIFIC', 'IMPERATIVE_DIRECT', 'IMPERATIVE_QUALIFIED']).toContain(result.category);
    });
  }
});

// -----------------------------------------------------------------------
// CONTEXT_ONLY: critical negative tests
// -----------------------------------------------------------------------
describe('classifies CONTEXT_ONLY (must NOT be actionable)', () => {
  const contextExamples = [
    'This guide provides comprehensive information for AI agents working with the codebase.',
    'Actual Budget is a local-first personal finance tool written in TypeScript.',
    'Repository: https://github.com/actualbudget/actual',
    'The frontend is built with React and uses TypeScript.',
    'This is the tldraw monorepo for React applications.',
    'Twenty is an open-source CRM built with modern technologies.',
    'https://actualbudget.org/docs',
    'See https://go.dev/wiki/CodeReviewComments for reference.',
    '**Repository**: https://github.com/actualbudget/actual',
    '**License**: MIT',
    '**Primary Language**: TypeScript (with React)',
  ];

  for (const ex of contextExamples) {
    it(`filters as context: "${ex.substring(0, 60)}..."`, () => {
      const result = classify(ex);
      expect(result.category).toBe('CONTEXT_ONLY');
    });
  }
});

// -----------------------------------------------------------------------
// Confidence scoring
// -----------------------------------------------------------------------
describe('confidence scoring', () => {
  it('assigns 0.95 to difficulty 1 (IMPERATIVE_DIRECT)', () => {
    expect(classify('Always run tests before committing').confidence).toBe(0.95);
  });

  it('assigns 0.85 to difficulty 2 (WORKFLOW)', () => {
    expect(classify('Sign off every commit with git commit -s').confidence).toBe(0.85);
  });

  it('assigns 0.70 to difficulty 3 (PATTERN_REFERENCE)', () => {
    expect(classify('Follow existing patterns in the codebase').confidence).toBe(0.70);
  });

  it('assigns 0.90 to CONTEXT_ONLY', () => {
    const result = classify('This is a TypeScript project with React.');
    expect(result.confidence).toBe(0.90);
  });

  it('assigns 0.50 to UNKNOWN', () => {
    const result = classify('something ambiguous here');
    expect(result.category).toBe('UNKNOWN');
    expect(result.confidence).toBe(0.50);
  });
});
