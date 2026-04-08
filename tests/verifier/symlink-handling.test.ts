// Tests for symlink handling in file walking and safe-path utilities.
// Verifies that symlinks are skipped or flagged appropriately.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync, writeFileSync, symlinkSync, mkdirSync, rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyOutput } from '../../src/verifier/index.js';
import type { RuleSet, Rule } from '../../src/types.js';

/**
 * Build a minimal RuleSet containing a single kebab-case naming rule.
 * This exercises the file-verifier path, which is where collectFiles lives.
 */
function makeKebabCaseRuleSet(): RuleSet {
  const rule: Rule = {
    id: 'naming-kebab-case-files-1',
    description: 'File names must be kebab-case',
    category: 'naming',
    severity: 'error',
    verifier: 'filesystem',
    pattern: { type: 'kebab-case', target: '*.ts', expected: null },
    source: 'test fixture',
  };
  return {
    sourceFile: 'test',
    sourceType: 'CLAUDE.md',
    rules: [rule],
    unparseable: [],
  };
}

describe('symlink handling in verifyOutput', () => {
  let projectDir: string;
  let outsideDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'ruleprobe-symlink-verify-'));
    outsideDir = mkdtempSync(join(tmpdir(), 'ruleprobe-symlink-outside-'));

    // Create a valid source file inside the project
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'good-file.ts'),
      'export const x = 1;\n',
    );

    // Create a file with a non-kebab-case name OUTSIDE the project,
    // then symlink it into the project. If symlinks are followed,
    // this file will show up as a naming violation. If skipped, it won't.
    writeFileSync(
      join(outsideDir, 'BadName.ts'),
      'export const y = 2;\n',
    );
    symlinkSync(
      join(outsideDir, 'BadName.ts'),
      join(projectDir, 'src', 'BadName.ts'),
    );
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('skips symlinked files when allowSymlinks is false', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const ruleSet = makeKebabCaseRuleSet();
    const results = await verifyOutput(ruleSet, projectDir, { allowSymlinks: false });

    // The symlinked BadName.ts should have been skipped,
    // so the only file checked is good-file.ts (which passes)
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
    expect(results[0]!.evidence).toHaveLength(0);

    // A warning should have been emitted for the skipped symlink
    const warnings = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('skipping symlink'))).toBe(true);

    stderrSpy.mockRestore();
  });

  it('follows symlinked files when allowSymlinks is true', async () => {
    const ruleSet = makeKebabCaseRuleSet();
    const results = await verifyOutput(ruleSet, projectDir, { allowSymlinks: true });

    // The symlinked BadName.ts should now be included and fail kebab-case
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(false);
    expect(results[0]!.evidence.length).toBeGreaterThan(0);
    expect(results[0]!.evidence[0]!.found).toBe('BadName.ts');
  });

  it('defaults to skipping symlinks when no options provided', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const ruleSet = makeKebabCaseRuleSet();
    const results = await verifyOutput(ruleSet, projectDir);

    // Default behavior: symlinks skipped, only real files checked
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);

    stderrSpy.mockRestore();
  });
});
