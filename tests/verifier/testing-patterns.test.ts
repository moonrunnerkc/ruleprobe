/**
 * Tests for testing pattern matcher extraction and verification.
 *
 * Covers test colocation, describe/it structure, and
 * no-console-in-tests rules.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import { checkDescribeItStructure, checkNoConsoleInTests } from '../../src/verifier/test-regex-checks.js';
import type { MarkdownSection } from '../../src/types.js';

function makeSections(lines: string[]): MarkdownSection[] {
  return [{
    header: 'Testing',
    level: 2,
    lines,
    codeBlocks: [],
  }];
}

describe('testing matcher extraction', () => {
  beforeEach(() => { resetRuleCounter(); });

  it('extracts "Colocate tests with source files"', () => {
    const { rules } = extractRules(makeSections(['Colocate tests with source files']));
    const match = rules.find((r) => r.id.includes('testing-colocate'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('test-colocation');
  });

  it('extracts "Use describe/it blocks"', () => {
    const { rules } = extractRules(makeSections(['Use describe/it blocks']));
    const match = rules.find((r) => r.id.includes('testing-describe'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('describe-it-structure');
  });

  it('extracts "Organize tests with describe blocks"', () => {
    const { rules } = extractRules(makeSections(['Organize tests with describe blocks']));
    const match = rules.find((r) => r.id.includes('testing-describe'));
    expect(match).toBeDefined();
  });

  it('extracts "No console.log in tests"', () => {
    const { rules } = extractRules(makeSections(['No console.log in tests']));
    const match = rules.find((r) => r.id.includes('testing-no-console'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('no-console-in-tests');
  });

  it('sets category to testing', () => {
    const { rules } = extractRules(makeSections(['Colocate tests with source files']));
    const match = rules.find((r) => r.id.includes('testing'));
    expect(match).toBeDefined();
    expect(match!.category).toBe('testing');
  });
});

describe('checkDescribeItStructure', () => {
  it('passes when test file has describe and it blocks', () => {
    const content = `
describe('utils', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`;
    const evidence = checkDescribeItStructure(content, 'utils.test.ts', 'utils.test.ts');
    expect(evidence).toHaveLength(0);
  });

  it('flags test file missing describe block', () => {
    const content = `
test('should work', () => {
  expect(true).toBe(true);
});`;
    const evidence = checkDescribeItStructure(content, 'utils.test.ts', 'utils.test.ts');
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0]!.found).toContain('no describe');
  });

  it('skips non-test files', () => {
    const content = 'const x = 1;';
    const evidence = checkDescribeItStructure(content, 'utils.ts', 'utils.ts');
    expect(evidence).toHaveLength(0);
  });
});

describe('checkNoConsoleInTests', () => {
  it('passes when test has no console statements', () => {
    const content = `
describe('clean test', () => {
  it('works', () => {
    expect(1).toBe(1);
  });
});`;
    const evidence = checkNoConsoleInTests(content, 'clean.test.ts', 'clean.test.ts');
    expect(evidence).toHaveLength(0);
  });

  it('flags console.log in test file', () => {
    const content = `
describe('test', () => {
  it('logs', () => {
    console.log('debug');
    expect(1).toBe(1);
  });
});`;
    const evidence = checkNoConsoleInTests(content, 'debug.test.ts', 'debug.test.ts');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.found).toContain('console statement');
  });

  it('skips non-test files', () => {
    const content = 'console.log("hello");';
    const evidence = checkNoConsoleInTests(content, 'app.ts', 'app.ts');
    expect(evidence).toHaveLength(0);
  });
});
