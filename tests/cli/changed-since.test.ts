/**
 * End-to-end integration tests for `ruleprobe verify --changed-since`.
 *
 * Builds a real git repository in a tmpdir and invokes the built CLI
 * via execFileSync (no shell expansion, no mocks). Exercises:
 *   - full run reports all violations
 *   - --changed-since base reports only files in the diff
 *   - empty diff: per-file rules report nothing, project rules still run
 *   - invalid ref: exit 2, ref name in stderr
 *   - missing git on PATH: exit 2, "git" in stderr
 *
 * Skips automatically if `git` is not on PATH or if the built CLI is
 * not present at dist/cli.js.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');
const CLI = join(PROJECT_ROOT, 'dist', 'cli.js');
const NODE = process.execPath;

const AGENTS_MD = `# Rules

- Never use \`any\`. Use \`unknown\` and narrow.
- Use kebab-case for filenames.
- Always use named exports. Never use default exports.
`;

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): RunResult {
  try {
    const stdout = execFileSync(NODE, [CLI, ...args], {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      exitCode: e.status ?? -1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

function git(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function evidenceFiles(json: string, ruleId: string): string[] {
  const report = JSON.parse(json) as {
    results: Array<{ rule: { id: string }; evidence: Array<{ file: string }> }>;
  };
  const result = report.results.find((r) => r.rule.id === ruleId);
  return result ? result.evidence.map((e) => e.file) : [];
}

const cliBuilt = existsSync(CLI);
const gitAvailable = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const skip = !cliBuilt || !gitAvailable;

describe.skipIf(skip)('verify --changed-since (real git fixture)', () => {
  let fixture: string;
  let baseSha: string;

  beforeAll(() => {
    fixture = mkdtempSync(join(tmpdir(), 'ruleprobe-changed-since-'));
    mkdirSync(join(fixture, 'src'), { recursive: true });
    writeFileSync(join(fixture, 'AGENTS.md'), AGENTS_MD);
    writeFileSync(join(fixture, 'src', 'clean.ts'), 'export const a = 1;\n');
    writeFileSync(join(fixture, 'src', 'dirty.ts'), 'export const b: any = 2;\n');

    git(['init', '-q', '-b', 'main'], fixture);
    git(['config', 'user.email', 'test@example.com'], fixture);
    git(['config', 'user.name', 'Test'], fixture);
    git(['add', '-A'], fixture);
    git(['commit', '-q', '-m', 'base'], fixture);
    baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture, encoding: 'utf-8' }).trim();
    git(['tag', 'base'], fixture);

    // Modify clean.ts only: introduce a new `any` violation.
    writeFileSync(join(fixture, 'src', 'clean.ts'), "export const a: any = 'now violates';\n");
    git(['add', '-A'], fixture);
    git(['commit', '-q', '-m', 'introduce violation in clean.ts'], fixture);
  });

  afterAll(() => {
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  it('full run reports the violation in both clean.ts and dirty.ts', () => {
    const r = runCli(['verify', 'AGENTS.md', 'src', '--format', 'json'], { cwd: fixture });
    expect(r.exitCode).not.toBe(2);
    const files = evidenceFiles(r.stdout, 'forbidden-no-any-type-1');
    expect(files.some((f) => f.endsWith('clean.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('dirty.ts'))).toBe(true);
  });

  it('--changed-since base reports only clean.ts, not dirty.ts', () => {
    const r = runCli(
      ['verify', 'AGENTS.md', 'src', '--changed-since', 'base', '--format', 'json'],
      { cwd: fixture },
    );
    expect(r.exitCode).not.toBe(2);
    const files = evidenceFiles(r.stdout, 'forbidden-no-any-type-1');
    expect(files.some((f) => f.endsWith('clean.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('dirty.ts'))).toBe(false);
  });

  it('--changed-since accepts a commit SHA in addition to tags', () => {
    const r = runCli(
      ['verify', 'AGENTS.md', 'src', '--changed-since', baseSha, '--format', 'json'],
      { cwd: fixture },
    );
    expect(r.exitCode).not.toBe(2);
    const files = evidenceFiles(r.stdout, 'forbidden-no-any-type-1');
    expect(files.some((f) => f.endsWith('clean.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('dirty.ts'))).toBe(false);
  });

  it('--changed-since HEAD (empty diff) reports no per-file violations', () => {
    const r = runCli(
      ['verify', 'AGENTS.md', 'src', '--changed-since', 'HEAD', '--format', 'json'],
      { cwd: fixture },
    );
    expect(r.exitCode).not.toBe(2);
    const files = evidenceFiles(r.stdout, 'forbidden-no-any-type-1');
    expect(files).toHaveLength(0);
  });

  it('invalid ref exits 2 with the ref name in stderr', () => {
    const ref = 'nonexistent-ref-xyz-12345';
    const r = runCli(
      ['verify', 'AGENTS.md', 'src', '--changed-since', ref, '--format', 'text'],
      { cwd: fixture },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain(ref);
  });

  it('missing git on PATH exits 2 and names git in the error', () => {
    const env = { ...process.env, PATH: '' };
    const r = runCli(
      ['verify', 'AGENTS.md', 'src', '--changed-since', 'base', '--format', 'text'],
      { cwd: fixture, env },
    );
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toLowerCase()).toContain('git');
  });

  it('flag omitted produces no error and reports both violations', () => {
    // Regression: default behavior (no flag) is unchanged after the feature.
    const r = runCli(['verify', 'AGENTS.md', 'src', '--format', 'json'], { cwd: fixture });
    expect(r.exitCode).not.toBe(2);
    const files = evidenceFiles(r.stdout, 'forbidden-no-any-type-1');
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
});
