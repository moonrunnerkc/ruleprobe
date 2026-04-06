import { describe, it, expect } from 'vitest';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const CLI = 'npx tsx src/cli.ts';
const CLAUDE_FIXTURE = 'tests/fixtures/sample-claude.md';
const AGENTS_FIXTURE = 'tests/fixtures/sample-agents.md';
const PASSING_DIR = 'tests/fixtures/sample-output/passing';
const FAILING_DIR = 'tests/fixtures/sample-output/failing';

const execOpts: ExecSyncOptionsWithStringEncoding = {
  cwd: ROOT,
  encoding: 'utf-8',
  timeout: 30000,
};

/**
 * Run a CLI command and return stdout.
 * Throws on non-zero exit code.
 */
function run(args: string): string {
  return execSync(`${CLI} ${args}`, execOpts);
}

/**
 * Run a CLI command expecting it to fail.
 * Returns stderr content and exit code.
 */
function runFail(args: string): { stderr: string; status: number } {
  try {
    execSync(`${CLI} ${args}`, { ...execOpts, stdio: 'pipe' });
    throw new Error('Expected command to fail but it succeeded');
  } catch (err) {
    const e = err as { stderr?: string; status?: number };
    return {
      stderr: e.stderr ?? '',
      status: e.status ?? 1,
    };
  }
}

// ── parse command ──────────────────────────────────────────────

describe('CLI: parse command', () => {
  it('outputs JSON when --format json', () => {
    const output = run(`parse ${CLAUDE_FIXTURE} --format json`);
    const parsed = JSON.parse(output);
    expect(parsed.sourceFile).toBeDefined();
    expect(parsed.rules).toBeInstanceOf(Array);
    expect(parsed.rules.length).toBeGreaterThan(0);
  });

  it('outputs text by default', () => {
    const output = run(`parse ${CLAUDE_FIXTURE}`);
    expect(output).toContain('Extracted');
    expect(output).toContain('rules');
  });

  it('includes unparseable lines with --show-unparseable', () => {
    const output = run(`parse ${CLAUDE_FIXTURE} --show-unparseable`);
    expect(output).toContain('Unparseable');
  });

  it('fails with actionable error for missing file', () => {
    const { stderr, status } = runFail('parse nonexistent-file.md');
    expect(status).toBe(1);
    expect(stderr).toContain('File not found');
  });
});

// ── verify command ─────────────────────────────────────────────

describe('CLI: verify command', () => {
  it('produces text output for passing fixtures', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --agent test-agent --model test-model`,
    );
    expect(output).toContain('RuleProbe Adherence Report');
    expect(output).toContain('PASS');
  });

  it('produces JSON output with --format json', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --format json`,
    );
    const parsed = JSON.parse(output);
    expect(parsed.summary).toBeDefined();
    expect(parsed.results).toBeInstanceOf(Array);
  });

  it('produces markdown output with --format markdown', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --format markdown`,
    );
    expect(output).toContain('# RuleProbe Adherence Report');
  });

  it('shows failures for failing fixtures', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${FAILING_DIR} --agent bad-agent --model bad-model`,
    );
    expect(output).toContain('FAIL');
  });

  it('fails with actionable error for missing instruction file', () => {
    const { stderr, status } = runFail(
      `verify nonexistent.md ${PASSING_DIR}`,
    );
    expect(status).toBe(1);
    expect(stderr).toContain('not found');
  });

  it('fails with actionable error for missing output directory', () => {
    const { stderr, status } = runFail(
      `verify ${CLAUDE_FIXTURE} /tmp/ruleprobe-nonexistent-dir-xyz`,
    );
    expect(status).toBe(1);
    expect(stderr).toContain('does not exist');
  });
});

// ── tasks command ──────────────────────────────────────────────

describe('CLI: tasks command', () => {
  it('lists available task templates', () => {
    const output = run('tasks');
    expect(output).toContain('rest-endpoint');
    expect(output).toContain('utility-module');
    expect(output).toContain('react-component');
  });

  it('shows template descriptions', () => {
    const output = run('tasks');
    expect(output).toContain('REST API');
  });
});

// ── task command ───────────────────────────────────────────────

describe('CLI: task command', () => {
  it('shows template info for a valid template', () => {
    const output = run('task rest-endpoint');
    expect(output).toContain('rest-endpoint');
  });

  it('fails for unknown template', () => {
    const { stderr, status } = runFail('task nonexistent-template');
    expect(status).toBe(1);
    expect(stderr).toContain('Unknown task template');
  });
});

// ── compare command ────────────────────────────────────────────

describe('CLI: compare command', () => {
  it('produces markdown comparison table', () => {
    const output = run(
      `compare ${CLAUDE_FIXTURE} ${PASSING_DIR} ${FAILING_DIR} ` +
      '--agents passing,failing --format markdown',
    );
    expect(output).toContain('Adherence Comparison');
    expect(output).toContain('passing');
    expect(output).toContain('failing');
    expect(output).toContain('PASS');
    expect(output).toContain('FAIL');
  });
});

// ── help ───────────────────────────────────────────────────────

describe('CLI: help', () => {
  it('shows help text with --help', () => {
    const output = run('--help');
    expect(output).toContain('ruleprobe');
    expect(output).toContain('parse');
    expect(output).toContain('verify');
    expect(output).toContain('tasks');
    expect(output).toContain('compare');
  });
});
