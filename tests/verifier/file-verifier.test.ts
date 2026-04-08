// Tests for the filesystem-based rule verifier and file collection utilities.
// Covers required-file, forbidden-file, required-directory, and file-pattern checks.

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { verifyFileSystemRule, collectFiles } from '../../src/verifier/file-verifier.js';
import type { Rule } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingDir = resolve(fixturesDir, 'passing');
const failingDir = resolve(fixturesDir, 'failing');

/** Build a minimal Rule object for testing filesystem checks. */
function makeRule(
  patternType: string,
  expected: string | boolean = 'test',
): Rule {
  return {
    id: `test-${patternType}`,
    category: 'naming',
    source: 'test rule',
    description: `test ${patternType}`,
    severity: 'error',
    verifier: 'filesystem',
    pattern: {
      type: patternType,
      target: '*.ts',
      expected,
      scope: 'project',
    },
  };
}

// -- Passing fixtures --

describe('File verifier: passing fixtures', () => {
  it('finds no kebab-case violations in passing directory', () => {
    const rule = makeRule('kebab-case');
    const result = verifyFileSystemRule(rule, passingDir, collectFiles(passingDir));
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no missing test files in passing directory', () => {
    const rule = makeRule('test-files-exist', true);
    const result = verifyFileSystemRule(rule, passingDir, collectFiles(passingDir));
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('finds no file length violations in passing directory (300 line max)', () => {
    const rule = makeRule('max-file-length', '300');
    const result = verifyFileSystemRule(rule, passingDir, collectFiles(passingDir));
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });
});

// -- Failing fixtures: kebab-case --

describe('File verifier: kebab-case file naming', () => {
  it('detects PascalCase file name violations', () => {
    const rule = makeRule('kebab-case');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));
    expect(result.passed).toBe(false);

    // UserService.ts violates kebab-case
    const violation = result.evidence.find((e) => e.found === 'UserService.ts');
    expect(violation).toBeDefined();
  });

  it('does not flag kebab-case file names', () => {
    const rule = makeRule('kebab-case');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));

    // helpers.ts, long-file.ts, line-length.ts are all valid kebab-case
    const wrongFlags = result.evidence.filter((e) =>
      e.found === 'helpers.ts' || e.found === 'long-file.ts' || e.found === 'line-length.ts'
    );
    expect(wrongFlags).toHaveLength(0);
  });
});

// -- Failing fixtures: test files --

describe('File verifier: test file existence', () => {
  it('detects missing test files in failing directory', () => {
    const rule = makeRule('test-files-exist', true);
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));
    expect(result.passed).toBe(false);

    // Failing directory has src/ files but no tests/ directory at all
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((e) => e.found === 'no test file found')).toBe(true);
  });
});

// -- Failing fixtures: file length --

describe('File verifier: max file length', () => {
  it('detects files exceeding 300-line limit', () => {
    const rule = makeRule('max-file-length', '300');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));
    expect(result.passed).toBe(false);

    // long-file.ts has 509 lines
    const longFileViolation = result.evidence.find((e) =>
      e.file.includes('long-file')
    );
    expect(longFileViolation).toBeDefined();
    expect(longFileViolation!.found).toMatch(/\d+ lines/);
  });

  it('reports correct line count in evidence', () => {
    const rule = makeRule('max-file-length', '300');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));

    const longFileViolation = result.evidence.find((e) =>
      e.file.includes('long-file')
    );
    expect(longFileViolation).toBeDefined();
    // The file has 509 lines
    expect(longFileViolation!.found).toContain('509');
  });
});

// -- Strict mode --

describe('File verifier: strict mode', () => {
  it('finds tsconfig.json in ancestor directory', () => {
    const rule = makeRule('strict-mode', true);
    // failingDir is under project root, which has tsconfig.json with strict: true
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir));
    expect(result.passed).toBe(true);
  });

  it('fails when no tsconfig.json exists in any ancestor', () => {
    const rule = makeRule('strict-mode', true);
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      const result = verifyFileSystemRule(rule, isolated, collectFiles(isolated));
      expect(result.passed).toBe(false);
      expect(result.evidence[0]!.found).toContain('tsconfig.json not found');
      expect(result.evidence[0]!.found).toContain('searched');
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('fails when tsconfig.json lacks strict: true', () => {
    const rule = makeRule('strict-mode', true);
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      const tsconfigPath = join(isolated, 'tsconfig.json');
      writeFileSync(tsconfigPath, JSON.stringify({ compilerOptions: { strict: false } }));
      const result = verifyFileSystemRule(rule, isolated, collectFiles(isolated));
      expect(result.passed).toBe(false);
      expect(result.evidence[0]!.found).toContain('strict');
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });
});

describe('File verifier: kebab-case directories', () => {
  it('passes when all directories use kebab-case', () => {
    const rule = makeRule('kebab-case-directories');
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      mkdirSync(join(isolated, 'src', 'auth-wizard'), { recursive: true });
      mkdirSync(join(isolated, 'src', 'user-profile'), { recursive: true });
      writeFileSync(join(isolated, 'src', 'auth-wizard', 'index.ts'), '');
      writeFileSync(join(isolated, 'src', 'user-profile', 'helpers.ts'), '');
      const files = collectFiles(isolated);
      const result = verifyFileSystemRule(rule, isolated, files);
      expect(result.passed).toBe(true);
      expect(result.evidence).toHaveLength(0);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('detects camelCase directory names', () => {
    const rule = makeRule('kebab-case-directories');
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      mkdirSync(join(isolated, 'src', 'authWizard'), { recursive: true });
      writeFileSync(join(isolated, 'src', 'authWizard', 'index.ts'), '');
      const files = collectFiles(isolated);
      const result = verifyFileSystemRule(rule, isolated, files);
      expect(result.passed).toBe(false);
      expect(result.evidence.length).toBeGreaterThanOrEqual(1);
      expect(result.evidence.some(e => e.found === 'authWizard')).toBe(true);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('detects PascalCase directory names', () => {
    const rule = makeRule('kebab-case-directories');
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      mkdirSync(join(isolated, 'components', 'UserProfile'), { recursive: true });
      writeFileSync(join(isolated, 'components', 'UserProfile', 'view.ts'), '');
      const files = collectFiles(isolated);
      const result = verifyFileSystemRule(rule, isolated, files);
      expect(result.passed).toBe(false);
      expect(result.evidence.some(e => e.found === 'UserProfile')).toBe(true);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('skips hidden directories and node_modules', () => {
    const rule = makeRule('kebab-case-directories');
    const isolated = mkdtempSync(join(tmpdir(), 'ruleprobe-test-'));
    try {
      // These should not be checked
      mkdirSync(join(isolated, '.github'), { recursive: true });
      mkdirSync(join(isolated, 'src'), { recursive: true });
      writeFileSync(join(isolated, 'src', 'index.ts'), '');
      const files = collectFiles(isolated);
      const result = verifyFileSystemRule(rule, isolated, files);
      expect(result.passed).toBe(true);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });
});
