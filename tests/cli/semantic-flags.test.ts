/**
 * Tests for semantic CLI flags on the analyze command.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(__dirname, '../../dist/cli.js');
const FIXTURE_DIR = resolve(__dirname, '../semantic/fixtures/sample-project');

/** Helper to run the CLI as a child process. */
function runCli(args: string[], env?: Record<string, string>): { stdout: string; stderr: string } {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('analyze command semantic flags', () => {
  it('shows semantic section when --semantic flag is used without a key', () => {
    const { stdout } = runCli(['analyze', FIXTURE_DIR, '--semantic'], {
      ANTHROPIC_API_KEY: '',
    });
    // Empty string key passes config resolution; semantic analysis runs but finds zero rules
    expect(stdout).toContain('Semantic Analysis');
  });

  it('accepts --anthropic-key flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--anthropic-key', 'sk-ant-test-key',
    ]);
    // Will fail to connect but should not crash from flag parsing
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --max-llm-calls flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--anthropic-key', 'sk-ant-test-key',
      '--max-llm-calls', '5',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --no-cache flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--anthropic-key', 'sk-ant-test-key',
      '--no-cache',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --semantic-log flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--anthropic-key', 'sk-ant-test-key',
      '--semantic-log',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --cost-report flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--anthropic-key', 'sk-ant-test-key',
      '--cost-report',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('runs deterministic analysis without --semantic flag', () => {
    const { stdout } = runCli(['analyze', FIXTURE_DIR]);
    expect(stdout).toContain('Project Analysis');
  });
});
