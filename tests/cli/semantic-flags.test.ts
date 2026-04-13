/**
 * Tests for semantic CLI flags on the analyze command.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI_PATH = resolve(__dirname, '../../dist/cli.js');
const FIXTURE_DIR = resolve(__dirname, '../semantic/fixtures/sample-project');

let server: Server;
let port: number;

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
  it('accepts --semantic flag without error when no key is provided', () => {
    const { stderr } = runCli(['analyze', FIXTURE_DIR, '--semantic'], {
      RULEPROBE_LICENSE_KEY: '',
    });
    expect(stderr).toContain('license key');
  });

  it('accepts --license-key flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--license-key', 'test-key-abc',
    ]);
    // Will fail to connect but should not crash from flag parsing
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --max-llm-calls flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--license-key', 'test-key-abc',
      '--max-llm-calls', '5',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --no-cache flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--license-key', 'test-key-abc',
      '--no-cache',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --semantic-log flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--license-key', 'test-key-abc',
      '--semantic-log',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('accepts --cost-report flag', () => {
    const { stderr } = runCli([
      'analyze', FIXTURE_DIR,
      '--semantic',
      '--license-key', 'test-key-abc',
      '--cost-report',
    ]);
    expect(stderr).not.toContain('unknown option');
  });

  it('runs deterministic analysis without --semantic flag', () => {
    const { stdout } = runCli(['analyze', FIXTURE_DIR]);
    expect(stdout).toContain('Project Analysis');
  });
});
