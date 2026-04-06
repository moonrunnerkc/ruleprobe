/**
 * Tests for CLI exit codes.
 *
 * Verifies that the verify command returns meaningful exit codes:
 *   0 - all rules passed
 *   1 - one or more rule violations found
 *   2 - execution error (file not found, parse failure, etc)
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const CLI = 'npx tsx src/cli.ts';
const CLAUDE_FIXTURE = 'tests/fixtures/sample-claude.md';
const PASSING_DIR = 'tests/fixtures/sample-output/passing';
const FAILING_DIR = 'tests/fixtures/sample-output/failing';

/**
 * Run a CLI command and return the exit code.
 * Captures stdout/stderr to prevent test output noise.
 */
function getExitCode(args: string): number {
  try {
    execSync(`${CLI} ${args}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: 'pipe',
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number };
    return e.status ?? -1;
  }
}

describe('CLI: verify exit codes', () => {
  it('exits 0 when all rules pass', () => {
    const code = getExitCode(
      `verify ${CLAUDE_FIXTURE} ${PASSING_DIR} --format text`,
    );
    expect(code).toBe(0);
  });

  it('exits 1 when violations are found', () => {
    const code = getExitCode(
      `verify ${CLAUDE_FIXTURE} ${FAILING_DIR} --format text`,
    );
    expect(code).toBe(1);
  });

  it('exits 2 for a nonexistent instruction file', () => {
    const code = getExitCode(
      `verify nonexistent-rules.md ${PASSING_DIR} --format text`,
    );
    expect(code).toBe(2);
  });

  it('exits 2 for a nonexistent output directory', () => {
    const code = getExitCode(
      `verify ${CLAUDE_FIXTURE} /tmp/ruleprobe-does-not-exist-xyz --format text`,
    );
    expect(code).toBe(2);
  });
});
