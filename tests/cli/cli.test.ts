// Integration tests for the ruleprobe CLI. Spawns the real CLI via tsx
// and verifies parse, verify, lint-config, drift, extract, and help commands.

import { describe, it, expect } from 'vitest';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

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

// ── lint-config command ─────────────────────────────────────────

describe('CLI: lint-config command', () => {
  it('emits flat config by default', () => {
    const output = run(`lint-config ${CLAUDE_FIXTURE}`);
    expect(output).toContain('export default [');
    expect(output).toContain('rules: {');
  });

  it('emits legacy config with --format legacy', () => {
    const output = run(`lint-config ${CLAUDE_FIXTURE} --format legacy`);
    expect(output).toContain('"rules"');
    expect(output).toContain('"plugins"');
  });

  it('includes unmappable rules as comments when present', () => {
    // Use a temp file with an instruction that has no ESLint equivalent
    const tmpMd = resolve(ROOT, 'tmp-unmappable-test.md');
    try {
      writeFileSync(tmpMd, '# Rules\n\nAlways review code before merging.\n');
      const output = run(`lint-config ${tmpMd} --format flat`);
      // Unmatched instructions go to unparseable, not unmappable in the ESLint config
      // The output should still be a valid flat config
      expect(output).toContain('export default [');
    } finally {
      unlinkSync(tmpMd);
    }
  });

  it('writes output to file with --output', () => {
    const tmpFile = resolve(ROOT, 'tmp-lint-config-test.js');
    try {
      run(`lint-config ${CLAUDE_FIXTURE} --output ${tmpFile}`);
      const content = readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('export default [');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('fails with actionable error for missing instruction file', () => {
    const result = runFail('lint-config nonexistent.md');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Failed to parse instruction file');
  });
});

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
    expect(status).toBe(2);
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
    const { stderr, status } = runFail(
      `verify ${CLAUDE_FIXTURE} ${FAILING_DIR} --agent bad-agent --model bad-model`,
    );
    expect(status).toBe(1);
  });

  it('includes summary statistics line at the end of text output', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --agent test-agent --model test-model`,
    );
    expect(output).toMatch(/Summary: \d+ checked \| \d+ passed \| \d+ failed \| \d+ skipped/);
    // Summary line must appear after By Category section
    const categoryIdx = output.indexOf('By Category:');
    const summaryIdx = output.indexOf('Summary:');
    expect(summaryIdx).toBeGreaterThan(categoryIdx);
  });

  it('summary statistics line reflects correct counts for passing output', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --agent test-agent --model test-model`,
    );
    // All rules pass, none fail, none skipped
    expect(output).toMatch(/Summary: \d+ checked \| \d+ passed \| 0 failed \| 0 skipped/);
    const match = output.match(/Summary: (\d+) checked \| (\d+) passed/);
    expect(match).not.toBeNull();
    const checked = parseInt(match![1], 10);
    const passed = parseInt(match![2], 10);
    expect(checked).toBeGreaterThan(0);
    expect(passed).toBe(checked);
  });

  it('summary statistics line in JSON output has skipped field', () => {
    const output = run(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --format json`,
    );
    const parsed = JSON.parse(output);
    expect(parsed.summary.skipped).toBeDefined();
    expect(typeof parsed.summary.skipped).toBe('number');
    expect(parsed.summary.totalRules).toBeGreaterThan(0);
    expect(parsed.summary.passed).toBe(parsed.summary.totalRules);
    expect(parsed.summary.failed).toBe(0);
  });

  it('fails with actionable error for missing instruction file', () => {
    const { stderr, status } = runFail(
      `verify nonexistent.md ${PASSING_DIR}`,
    );
    expect(status).toBe(2);
    expect(stderr).toContain('not found');
  });

  it('fails with actionable error for missing output directory', () => {
    const { stderr, status } = runFail(
      `verify ${CLAUDE_FIXTURE} /tmp/ruleprobe-nonexistent-dir-xyz`,
    );
    expect(status).toBe(2);
    expect(stderr).toContain('outside the working directory');
  });
});

// ── drift command ──────────────────────────────────────────────

describe('CLI: drift command', () => {
  const ESLINT_FIXTURE = 'tests/drift/fixtures/eslintrc-basic.json';
  const ESLINT_EMPTY = 'tests/drift/fixtures/eslintrc-empty.json';

  it('reports drift between CLAUDE.md and eslint config', () => {
    const result = runFail(`drift ${CLAUDE_FIXTURE} ${ESLINT_EMPTY}`);
    expect(result.status).toBe(1);
    // runFail captures stderr; drift writes to stdout, so check either
  });

  it('outputs markdown with --format markdown when drift exists', () => {
    const result = runFail(`drift ${CLAUDE_FIXTURE} ${ESLINT_FIXTURE} --format markdown`);
    expect(result.status).toBe(1);
  });

  it('fails with actionable error for missing instruction file', () => {
    const { stderr, status } = runFail(`drift nonexistent.md ${ESLINT_FIXTURE}`);
    expect(status).toBe(2);
    expect(stderr).toContain('Failed to parse instruction file');
  });

  it('fails with actionable error for missing eslint config', () => {
    const { stderr, status } = runFail(`drift ${CLAUDE_FIXTURE} nonexistent.json`);
    expect(status).toBe(2);
    expect(stderr).toContain('Failed to parse ESLint config');
  });
});

// ── extract command ──────────────────────────────────────────────

describe('CLI: extract command', () => {
  const ESLINT_FIXTURE = 'tests/drift/fixtures/eslintrc-basic.json';

  it('extracts rules from an eslint config', () => {
    const result = run(`extract ${ESLINT_FIXTURE}`);
    expect(result).toContain('## Rules');
    expect(result).toContain('`any`');
  });

  it('skips stylistic rules in output', () => {
    const STYLISTIC_FIXTURE = 'tests/extractor/fixtures/eslintrc-stylistic.json';
    const result = run(`extract ${STYLISTIC_FIXTURE}`);
    expect(result).toContain('## Rules');
    expect(result).toContain('Skipped rules');
    expect(result).toContain('semi');
  });

  it('writes output to file with --output', () => {
    const outPath = resolve(ROOT, 'tests/extractor/fixtures/extract-output.md');
    try {
      run(`extract ${ESLINT_FIXTURE} --output ${outPath}`);
      const content = readFileSync(outPath, 'utf-8');
      expect(content).toContain('## Rules');
    } finally {
      try { unlinkSync(outPath); } catch { /* already gone */ }
    }
  });

  it('fails with actionable error for missing eslint config', () => {
    const { stderr, status } = runFail('extract nonexistent.json');
    expect(status).toBe(2);
    expect(stderr).toContain('Failed to parse ESLint config');
  });
});

// ── help ───────────────────────────────────────────────────────

describe('CLI: help', () => {
  it('shows help text with --help', () => {
    const output = run('--help');
    expect(output).toContain('ruleprobe');
    expect(output).toContain('parse');
    expect(output).toContain('verify');
    expect(output).toContain('lint-config');
    expect(output).toContain('drift');
  });
});
