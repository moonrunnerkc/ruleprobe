import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { verifyRegexRule } from '../../src/verifier/regex-verifier.js';
import type { Rule } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingDir = resolve(fixturesDir, 'passing');
const failingDir = resolve(fixturesDir, 'failing');

/** Build a minimal Rule object for regex checks. */
function makeRule(patternType: string, expected: string): Rule {
  return {
    id: `test-${patternType}`,
    category: 'forbidden-pattern',
    source: 'test rule',
    description: `test ${patternType}`,
    severity: 'warning',
    verifier: 'regex',
    pattern: {
      type: patternType,
      target: '*.ts',
      expected,
      scope: 'file',
    },
  };
}

// -- Passing fixtures: line length --

describe('Regex verifier: passing fixtures', () => {
  const passingFiles = [
    resolve(passingDir, 'src/user-service.ts'),
    resolve(passingDir, 'src/types.ts'),
    resolve(passingDir, 'src/utils/validation.ts'),
  ];

  it('finds no line length violations with 120-char limit', () => {
    const rule = makeRule('max-line-length', '120');
    const result = verifyRegexRule(rule, passingFiles, passingDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no file length violations with 300-line limit', () => {
    const rule = makeRule('max-file-length', '300');
    const result = verifyRegexRule(rule, passingFiles, passingDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });
});

// -- Failing fixtures: line length --

describe('Regex verifier: max line length', () => {
  const failingFile = resolve(failingDir, 'src/line-length.ts');

  it('detects lines exceeding 100-character limit', () => {
    const rule = makeRule('max-line-length', '100');
    const result = verifyRegexRule(rule, [failingFile], failingDir);
    expect(result.passed).toBe(false);

    // Lines 10, 13, 14 exceed 100 chars
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it('includes correct line numbers for violations', () => {
    const rule = makeRule('max-line-length', '100');
    const result = verifyRegexRule(rule, [failingFile], failingDir);

    const lineNumbers = result.evidence.map((e) => e.line);
    // Line 10 (long JSDoc), line 13 (long variable name), line 14 (long return)
    expect(lineNumbers).toContain(10);
    expect(lineNumbers).toContain(13);
    expect(lineNumbers).toContain(14);
  });

  it('reports actual character count in evidence', () => {
    const rule = makeRule('max-line-length', '100');
    const result = verifyRegexRule(rule, [failingFile], failingDir);

    for (const e of result.evidence) {
      expect(e.found).toMatch(/\d+ characters/);
    }
  });
});


