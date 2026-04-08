// Extended AST verifier tests covering kebab-case directories and concise-conditionals checks.

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { verifyAstRule } from '../../src/verifier/ast-verifier.js';
import type { Rule } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingDir = resolve(fixturesDir, 'passing');
const failingDir = resolve(fixturesDir, 'failing');

const failingFile = resolve(failingDir, 'src/extended-violations.ts');
const passingFile = resolve(passingDir, 'src/extended-clean.ts');

/** Build a minimal Rule for a specific pattern type. */
function makeRule(patternType: string, expected: string | boolean = false): Rule {
  return {
    id: `test-${patternType}`,
    category: 'forbidden-pattern',
    source: 'test rule',
    description: `test ${patternType}`,
    severity: 'error',
    verifier: 'ast',
    pattern: { type: patternType, target: '*.ts', expected, scope: 'file' },
  };
}

describe('extended AST checks: failing fixtures', () => {
  it('detects empty catch blocks', () => {
    const result = verifyAstRule(makeRule('no-empty-catch'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
    expect(result.evidence[0]!.found).toContain('empty catch');
  });

  it('detects enum declarations', () => {
    const result = verifyAstRule(makeRule('no-enum'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.some((e) => e.found.includes('enum'))).toBe(true);
  });

  it('detects type assertions', () => {
    const result = verifyAstRule(makeRule('no-type-assertions'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('detects non-null assertions', () => {
    const result = verifyAstRule(makeRule('no-non-null-assertions'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('detects throwing non-Error values', () => {
    const result = verifyAstRule(makeRule('throw-error-only'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.some((e) => e.found.includes('something went wrong'))).toBe(true);
  });

  it('detects console.warn/error (extended)', () => {
    const result = verifyAstRule(makeRule('no-console-extended'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it('detects nested ternary', () => {
    const result = verifyAstRule(makeRule('no-nested-ternary'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('detects magic numbers', () => {
    const result = verifyAstRule(makeRule('no-magic-numbers'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('detects else after return', () => {
    const result = verifyAstRule(makeRule('no-else-after-return'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('detects namespace imports', () => {
    const result = verifyAstRule(makeRule('no-namespace-imports'), [failingFile]);
    expect(result.passed).toBe(false);
    expect(result.evidence.some((e) => e.found.includes('import * as'))).toBe(true);
  });
});

describe('extended AST checks: passing fixtures', () => {
  it('passes no-empty-catch on clean code', () => {
    const result = verifyAstRule(makeRule('no-empty-catch'), [passingFile]);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('passes no-enum on clean code', () => {
    const result = verifyAstRule(makeRule('no-enum'), [passingFile]);
    expect(result.passed).toBe(true);
  });

  it('passes no-type-assertions on clean code', () => {
    const result = verifyAstRule(makeRule('no-type-assertions'), [passingFile]);
    expect(result.passed).toBe(true);
  });

  it('passes no-else-after-return on clean code', () => {
    const result = verifyAstRule(makeRule('no-else-after-return'), [passingFile]);
    expect(result.passed).toBe(true);
  });

  it('passes no-namespace-imports on clean code', () => {
    const result = verifyAstRule(makeRule('no-namespace-imports'), [passingFile]);
    expect(result.passed).toBe(true);
  });
});

describe('extended AST checks: parameterized rules', () => {
  it('max-function-length detects long functions', () => {
    const result = verifyAstRule(makeRule('max-function-length', '5'), [failingFile]);
    expect(result.passed).toBe(false);
  });

  it('max-params detects functions with many parameters', () => {
    const result = verifyAstRule(makeRule('max-params', '1'), [failingFile]);
    expect(result.passed).toBe(false);
  });
});
