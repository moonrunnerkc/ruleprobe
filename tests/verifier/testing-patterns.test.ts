/**
 * Tests for testing pattern verification.
 *
 * Covers describe/it structure and no-console-in-tests checks.
 */

import { describe, it, expect } from 'vitest';
import { checkDescribeItStructure, checkNoConsoleInTests } from '../../src/verifier/test-regex-checks.js';

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
