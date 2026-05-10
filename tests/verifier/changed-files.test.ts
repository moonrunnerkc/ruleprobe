/**
 * Tests for changedFiles filtering in filesystem checks.
 *
 * Verifies that when a set of changed files is provided, only those
 * files are checked for per-file filesystem rules. Project-level rules
 * and cross-file rules still work correctly.
 */

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { verifyFileSystemRule, collectFiles } from '../../src/verifier/file-verifier.js';
import { verifyOutput } from '../../src/verifier/index.js';
import type { Rule, RuleSet } from '../../src/types.js';

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

// -- Kebab case with changedFiles --

describe('File verifier: kebab-case with changedFiles', () => {
  it('only checks files in the changedFiles set', () => {
    const rule = makeRule('kebab-case');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir), new Set());
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('reports violations only for changed files', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-'));
    try {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'good-file.ts'), 'export {};');
      writeFileSync(join(tmpDir, 'src', 'BadName.ts'), 'export {};');
      writeFileSync(join(tmpDir, 'src', 'AnotherBad.ts'), 'export {};');

      const files = collectFiles(tmpDir);
      const rule = makeRule('kebab-case');

      // Without changedFiles, both violations are found
      const fullResult = verifyFileSystemRule(rule, tmpDir, files);
      expect(fullResult.passed).toBe(false);
      expect(fullResult.evidence.length).toBe(2);

      // With changedFiles, only BadName.ts is checked
      const changedFiles = new Set([join(tmpDir, 'src', 'BadName.ts')]);
      const partialResult = verifyFileSystemRule(rule, tmpDir, files, changedFiles);
      expect(partialResult.passed).toBe(false);
      expect(partialResult.evidence.length).toBe(1);
      expect(partialResult.evidence[0]!.found).toBe('BadName.ts');

      // Unchanged file is skipped
      const unchangedFiles = new Set([join(tmpDir, 'src', 'good-file.ts')]);
      const cleanResult = verifyFileSystemRule(rule, tmpDir, files, unchangedFiles);
      expect(cleanResult.passed).toBe(true);
      expect(cleanResult.evidence).toHaveLength(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('checks all files when changedFiles is undefined', () => {
    const rule = makeRule('kebab-case');
    const result = verifyFileSystemRule(rule, failingDir, collectFiles(failingDir), undefined);
    expect(result.passed).toBe(false);

    const violation = result.evidence.find((e) => e.found === 'UserService.ts');
    expect(violation).toBeDefined();
  });
});

// -- Max file length with changedFiles --

describe('File verifier: max-file-length with changedFiles', () => {
  it('only checks length of changed files', () => {
    const rule = makeRule('max-file-length', '300');
    const files = collectFiles(failingDir);

    // Without changedFiles, the long file is flagged
    const fullResult = verifyFileSystemRule(rule, failingDir, files);
    expect(fullResult.passed).toBe(false);

    // With changedFiles set to only the short file, no violation
    const changedFiles = new Set([
      resolve(failingDir, 'helpers.ts'),
    ]);
    const partialResult = verifyFileSystemRule(rule, failingDir, files, changedFiles);
    expect(partialResult.passed).toBe(true);
    expect(partialResult.evidence).toHaveLength(0);
  });
});

// -- Kebab-case directories with changedFiles --

describe('File verifier: kebab-case-directories with changedFiles', () => {
  it('only checks directories that contain changed files', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-dir-'));
    try {
      mkdirSync(join(tmpDir, 'good-dir'), { recursive: true });
      mkdirSync(join(tmpDir, 'badDir'), { recursive: true });

      writeFileSync(join(tmpDir, 'good-dir', 'index.ts'), '');
      writeFileSync(join(tmpDir, 'badDir', 'index.ts'), '');

      const files = collectFiles(tmpDir);
      const rule = makeRule('kebab-case-directories');

      // Full check finds the camelCase directory
      const fullResult = verifyFileSystemRule(rule, tmpDir, files);
      expect(fullResult.passed).toBe(false);

      // Only changed file in the good directory - should pass
      const changedFiles = new Set([
        join(tmpDir, 'good-dir', 'index.ts'),
      ]);
      const partialResult = verifyFileSystemRule(rule, tmpDir, files, changedFiles);
      expect(partialResult.passed).toBe(true);
      expect(partialResult.evidence).toHaveLength(0);

      // Changed file in the bad directory - should fail
      const badChangedFiles = new Set([
        join(tmpDir, 'badDir', 'index.ts'),
      ]);
      const badPartialResult = verifyFileSystemRule(rule, tmpDir, files, badChangedFiles);
      expect(badPartialResult.passed).toBe(false);
      expect(badPartialResult.evidence.length).toBeGreaterThanOrEqual(1);
      expect(badPartialResult.evidence.some((e) => e.found === 'badDir')).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// -- Test files exist with changedFiles --

describe('File verifier: test-files-exist with changedFiles', () => {
  it('reports missing test for changed file even when test file itself is not in changedFiles', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-test-'));
    try {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      mkdirSync(join(tmpDir, 'tests'), { recursive: true });

      // has-test.ts has a test, missing-test.ts does not
      writeFileSync(join(tmpDir, 'src', 'has-test.ts'), 'export {};');
      writeFileSync(join(tmpDir, 'tests', 'has-test.test.ts'), '');

      writeFileSync(join(tmpDir, 'src', 'missing-test.ts'), 'export {};');

      const files = collectFiles(tmpDir);
      const rule = makeRule('test-files-exist', true);

      // Full check finds missing test
      const fullResult = verifyFileSystemRule(rule, tmpDir, files);
      expect(fullResult.passed).toBe(false);

      // Only the file that has a test is changed - should pass
      const hasTestChanged = new Set([
        join(tmpDir, 'src', 'has-test.ts'),
      ]);
      const hasTestResult = verifyFileSystemRule(rule, tmpDir, files, hasTestChanged);
      expect(hasTestResult.passed).toBe(true);
      expect(hasTestResult.evidence).toHaveLength(0);

      // Only the file missing a test is changed - should fail
      const missingTestChanged = new Set([
        join(tmpDir, 'src', 'missing-test.ts'),
      ]);
      const missingTestResult = verifyFileSystemRule(rule, tmpDir, files, missingTestChanged);
      expect(missingTestResult.passed).toBe(false);
      expect(missingTestResult.evidence.length).toBe(1);
      expect(missingTestResult.evidence[0]!.found).toBe('no test file found');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// -- Project-level checks with changedFiles --

describe('File verifier: project-level checks ignore changedFiles', () => {
  it('strict-mode check runs even with empty changedFiles', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-project-'));
    try {
      writeFileSync(join(tmpDir, 'index.ts'), 'export {};');

      const files = collectFiles(tmpDir);
      const rule = makeRule('strict-mode', true);

      // Without changedFiles, strict-mode fails
      const fullResult = verifyFileSystemRule(rule, tmpDir, files);
      expect(fullResult.passed).toBe(false);

      // With empty changedFiles, strict-mode still runs
      const emptyChanged = new Set();
      const emptyResult = verifyFileSystemRule(rule, tmpDir, files, emptyChanged);
      expect(emptyResult.passed).toBe(false);
      expect(emptyResult.evidence[0]!.found).toContain('tsconfig.json not found');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('changelog-exists check runs with changedFiles', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-changelog-'));
    try {
      writeFileSync(join(tmpDir, 'README.md'), '# Project');

      const files = collectFiles(tmpDir);
      const rule = makeRule('changelog-exists', true);

      const changedFiles = new Set([join(tmpDir, 'README.md')]);
      const result = verifyFileSystemRule(rule, tmpDir, files, changedFiles);
      expect(result.passed).toBe(false);
      expect(result.evidence[0]!.found).toBe('file not found');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// -- Orchestrator-level cross-file: test-files-exist via verifyOutput --

describe('verifyOutput orchestration: cross-file rules see the full file list', () => {
  /**
   * Locks in the fix that stops verifyOutput from pre-filtering allFiles
   * before handing them to filesystem rules. test-files-exist needs the
   * full picture so it can resolve tests/foo.test.ts even when only
   * src/foo.ts is in changedFiles.
   */
  function buildRuleSet(): RuleSet {
    const rule: Rule = {
      id: 'test-files-exist-1',
      category: 'naming',
      source: 'every src file must have a test',
      description: 'test-files-exist',
      severity: 'error',
      verifier: 'filesystem',
      pattern: {
        type: 'test-files-exist',
        target: '*.ts',
        expected: true,
        scope: 'project',
      },
    };
    return {
      sourceFile: 'AGENTS.md',
      sourceType: 'agents.md',
      rules: [rule],
      unparseable: [],
    };
  }

  it('passes for a changed src file whose test file is unchanged', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'ruleprobe-orch-')));
    try {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      mkdirSync(join(tmpDir, 'tests'), { recursive: true });
      writeFileSync(join(tmpDir, 'src', 'foo.ts'), 'export const x = 1;');
      writeFileSync(join(tmpDir, 'tests', 'foo.test.ts'), '');

      const ruleSet = buildRuleSet();
      const changedFiles = new Set([join(tmpDir, 'src', 'foo.ts')]);

      const results = await verifyOutput(ruleSet, tmpDir, { changedFiles });
      expect(results).toHaveLength(1);
      expect(results[0]!.passed).toBe(true);
      expect(results[0]!.evidence).toHaveLength(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails for a changed src file with no test, ignores unchanged src files', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'ruleprobe-orch-')));
    try {
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      mkdirSync(join(tmpDir, 'tests'), { recursive: true });
      // bar has no test; baz also has no test but is unchanged.
      writeFileSync(join(tmpDir, 'src', 'bar.ts'), 'export const x = 1;');
      writeFileSync(join(tmpDir, 'src', 'baz.ts'), 'export const y = 2;');

      const ruleSet = buildRuleSet();
      const changedFiles = new Set([join(tmpDir, 'src', 'bar.ts')]);

      const results = await verifyOutput(ruleSet, tmpDir, { changedFiles });
      expect(results).toHaveLength(1);
      expect(results[0]!.passed).toBe(false);
      const flaggedFiles = results[0]!.evidence.map((e) => e.file);
      expect(flaggedFiles).toContain('src/bar.ts');
      expect(flaggedFiles).not.toContain('src/baz.ts');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// -- Test file naming with changedFiles --

describe('File verifier: test-file-naming with changedFiles', () => {
  it('only checks test files in the changedFiles set', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-naming-'));
    try {
      mkdirSync(join(tmpDir, 'tests'), { recursive: true });

      writeFileSync(join(tmpDir, 'tests', 'good-file.test.ts'), '');
      writeFileSync(join(tmpDir, 'tests', 'bad-file.ts'), '');
      writeFileSync(join(tmpDir, 'tests', 'another-bad.ts'), '');

      const files = collectFiles(tmpDir);
      const rule = makeRule('test-file-naming', '*.test.ts');

      // Full check finds 2 violations
      const fullResult = verifyFileSystemRule(rule, tmpDir, files);
      expect(fullResult.passed).toBe(false);
      expect(fullResult.evidence.length).toBe(2);

      // Only one bad file changed
      const changedFiles = new Set([join(tmpDir, 'tests', 'bad-file.ts')]);
      const partialResult = verifyFileSystemRule(rule, tmpDir, files, changedFiles);
      expect(partialResult.passed).toBe(false);
      expect(partialResult.evidence.length).toBe(1);
      expect(partialResult.evidence[0]!.found).toBe('bad-file.ts');

      // Only the good file changed
      const goodChanged = new Set([join(tmpDir, 'tests', 'good-file.test.ts')]);
      const goodResult = verifyFileSystemRule(rule, tmpDir, files, goodChanged);
      expect(goodResult.passed).toBe(true);
      expect(goodResult.evidence).toHaveLength(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
