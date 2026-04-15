/**
 * Tests for git-history verifier.
 *
 * Uses real temp git repositories to test commit message and
 * branch naming verification. Creates and tears down git repos
 * for each test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { verifyGitHistoryRule } from '../../src/verifier/git-history-verifier.js';
import type { Rule } from '../../src/types.js';

let tempDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-git-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function initGitRepo(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'pipe' });
}

function addCommit(dir: string, message: string): void {
  const filename = `file-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  writeFileSync(join(dir, filename), message);
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: dir, stdio: 'pipe' });
}

function makeRule(type: string, target: string): Rule {
  return {
    id: `test-git-${type}`,
    source: `Git history rule: ${target}`,
    category: 'workflow',
    severity: 'warning',
    verifier: 'git-history',
    pattern: { type, target, expected: true, scope: 'project' },
    description: `Git history check for ${type}`,
  };
}

describe('git-history verifier: non-git directory', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes with explanatory evidence when not a git repo', () => {
    const result = verifyGitHistoryRule(makeRule('conventional-commits', 'conventional'), tempDir);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBe(1);
    expect(result.evidence[0]?.found).toContain('not a git repository');
  });
});

describe('git-history verifier: conventional-commits', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when all commits follow conventional format', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'feat: add user login');
    addCommit(tempDir, 'fix: resolve auth token expiry');
    addCommit(tempDir, 'docs: update README');
    const result = verifyGitHistoryRule(makeRule('conventional-commits', 'conventional'), tempDir);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBeGreaterThanOrEqual(0.8);
  });

  it('fails when commits do not follow conventional format', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'added user login');
    addCommit(tempDir, 'fixed the auth bug');
    addCommit(tempDir, 'updated docs');
    const result = verifyGitHistoryRule(makeRule('conventional-commits', 'conventional'), tempDir);
    expect(result.passed).toBe(false);
    expect(result.compliance).toBe(0);
  });

  it('gives partial compliance with mixed commit styles', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'feat: proper commit');
    addCommit(tempDir, 'fix: another good one');
    addCommit(tempDir, 'bad commit message');
    const result = verifyGitHistoryRule(makeRule('conventional-commits', 'conventional'), tempDir);
    // 2 out of 3 pass = ~0.67 compliance (below 0.8 threshold)
    expect(result.compliance).toBeCloseTo(2 / 3, 1);
    expect(result.passed).toBe(false);
  });

  it('handles empty repos gracefully', () => {
    initGitRepo(tempDir);
    const result = verifyGitHistoryRule(makeRule('conventional-commits', 'conventional'), tempDir);
    expect(result.passed).toBe(true);
  });
});

describe('git-history verifier: commit-message-prefix', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when commits have the required prefix', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, '[AI] implement feature');
    addCommit(tempDir, '[AI] fix bug');
    const result = verifyGitHistoryRule(makeRule('commit-message-prefix', '[AI]'), tempDir);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBe(1);
  });

  it('fails when commits lack the prefix', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'implement feature');
    addCommit(tempDir, 'fix bug');
    const result = verifyGitHistoryRule(makeRule('commit-message-prefix', '[AI]'), tempDir);
    expect(result.passed).toBe(false);
    expect(result.compliance).toBe(0);
  });
});

describe('git-history verifier: commit-message-pattern', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when commits match the regex pattern', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'short commit');
    addCommit(tempDir, 'another brief one');
    const result = verifyGitHistoryRule(makeRule('commit-message-pattern', '^.{1,72}$'), tempDir);
    expect(result.passed).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'test commit');
    const result = verifyGitHistoryRule(makeRule('commit-message-pattern', '[invalid'), tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence[0]?.found).toContain('invalid regex');
  });
});

describe('git-history verifier: branch-naming', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('skips check on main/master branches', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'initial commit');
    const result = verifyGitHistoryRule(
      makeRule('branch-naming', '^(feature|bugfix)/'),
      tempDir,
    );
    // main/master branches are protected, so check is skipped
    expect(result.passed).toBe(true);
  });

  it('passes when branch matches the pattern', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'initial commit');
    execSync('git checkout -b feature/test-branch', { cwd: tempDir, stdio: 'pipe' });
    const result = verifyGitHistoryRule(
      makeRule('branch-naming', '^feature/'),
      tempDir,
    );
    expect(result.passed).toBe(true);
  });

  it('fails when branch does not match the pattern', () => {
    initGitRepo(tempDir);
    addCommit(tempDir, 'initial commit');
    execSync('git checkout -b my-random-branch', { cwd: tempDir, stdio: 'pipe' });
    const result = verifyGitHistoryRule(
      makeRule('branch-naming', '^(feature|bugfix)/'),
      tempDir,
    );
    expect(result.passed).toBe(false);
  });
});
