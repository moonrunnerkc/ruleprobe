// Tests for the agent invoker: SDK availability detection, output directory checks,
// and invokeAgent execution (mocked subprocess).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAgentSdkAvailable, hasAgentOutput, invokeAgent } from '../../src/runner/agent-invoker.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AgentInvocationConfig } from '../../src/runner/agent-configs.js';

describe('isAgentSdkAvailable', () => {
  it('returns false when SDK is not installed', async () => {
    const available = await isAgentSdkAvailable();
    // The SDK is not a project dependency, so this should be false in test
    expect(available).toBe(false);
  });
});

describe('hasAgentOutput', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-invoker-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns true for existing directory', () => {
    expect(hasAgentOutput(tempDir)).toBe(true);
  });

  it('returns false for nonexistent directory', () => {
    expect(hasAgentOutput('/tmp/nonexistent-ruleprobe-dir-xyz')).toBe(false);
  });
});

describe('invokeAgent', () => {
  const baseConfig: AgentInvocationConfig = {
    agentId: 'claude-code',
    model: 'sonnet',
    apiKeyEnvVar: 'RULEPROBE_TEST_API_KEY',
    allowedTools: ['Read', 'Write'],
  };

  it('throws when API key is not set', async () => {
    delete process.env['RULEPROBE_TEST_API_KEY'];

    await expect(invokeAgent(baseConfig, 'test prompt'))
      .rejects.toThrow('RULEPROBE_TEST_API_KEY is not set');
  });

  it('throws with install instruction when SDK is unavailable', async () => {
    process.env['RULEPROBE_TEST_API_KEY'] = 'test-key';

    try {
      await expect(invokeAgent(baseConfig, 'test prompt'))
        .rejects.toThrow('npm install @anthropic-ai/claude-agent-sdk');
    } finally {
      delete process.env['RULEPROBE_TEST_API_KEY'];
    }
  });
});
