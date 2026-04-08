// Tests for agent configuration builders (buildAgentConfig).

import { describe, it, expect } from 'vitest';
import { buildAgentConfig } from '../../src/runner/agent-configs.js';

describe('buildAgentConfig', () => {
  it('returns claude-code config with correct defaults', () => {
    const config = buildAgentConfig('claude-code', 'sonnet');

    expect(config.agentId).toBe('claude-code');
    expect(config.model).toBe('sonnet');
    expect(config.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
    expect(config.allowedTools).toContain('Read');
    expect(config.allowedTools).toContain('Write');
    expect(config.allowedTools).toContain('Edit');
    expect(config.allowedTools).toContain('Bash');
  });

  it('uses the provided model override', () => {
    const config = buildAgentConfig('claude-code', 'opus');
    expect(config.model).toBe('opus');
  });

  it('returns a default config for unknown agents', () => {
    const config = buildAgentConfig('some-other-agent', 'gpt-4o');

    expect(config.agentId).toBe('some-other-agent');
    expect(config.model).toBe('gpt-4o');
    expect(config.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
  });
});
