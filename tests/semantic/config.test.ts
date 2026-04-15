/**
 * Tests for semantic analysis configuration resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveSemanticConfig } from '../../src/semantic/config.js';

describe('resolveSemanticConfig', () => {
  let tempDir: string;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-config-'));
    originalEnv['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
  });

  afterEach(() => {
    if (originalEnv['ANTHROPIC_API_KEY'] !== undefined) {
      process.env['ANTHROPIC_API_KEY'] = originalEnv['ANTHROPIC_API_KEY'];
    } else {
      delete process.env['ANTHROPIC_API_KEY'];
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no Anthropic API key is available', () => {
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).toBeNull();
  });

  it('resolves Anthropic API key from CLI flag first', () => {
    process.env['ANTHROPIC_API_KEY'] = 'env-key';
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'cli-key' });
    expect(result).not.toBeNull();
    expect(result!.anthropicApiKey).toBe('cli-key');
  });

  it('resolves Anthropic API key from env var when CLI flag missing', () => {
    process.env['ANTHROPIC_API_KEY'] = 'env-key';
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).not.toBeNull();
    expect(result!.anthropicApiKey).toBe('env-key');
  });

  it('resolves Anthropic API key from dotfile config when CLI and env are missing', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(
      join(dotDir, 'config.json'),
      JSON.stringify({ anthropicApiKey: 'dotfile-key' }),
    );
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).not.toBeNull();
    expect(result!.anthropicApiKey).toBe('dotfile-key');
  });

  it('sets default maxLlmCalls when CLI does not override', () => {
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'test-key' });
    expect(result!.maxLlmCalls).toBe(20);
  });

  it('overrides maxLlmCalls from CLI', () => {
    const result = resolveSemanticConfig(tempDir, {
      anthropicKey: 'test-key',
      maxLlmCalls: 5,
    });
    expect(result!.maxLlmCalls).toBe(5);
  });

  it('sets useCache to true by default', () => {
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'test-key' });
    expect(result!.useCache).toBe(true);
  });

  it('sets useCache to false when noCache is true', () => {
    const result = resolveSemanticConfig(tempDir, {
      anthropicKey: 'test-key',
      noCache: true,
    });
    expect(result!.useCache).toBe(false);
  });

  it('sets default fastPathThreshold', () => {
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'test-key' });
    expect(result!.fastPathThreshold).toBe(0.85);
  });

  it('handles malformed dotfile config gracefully', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(dotDir, 'config.json'), 'not json');
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.anthropicApiKey).toBe('test-key');
  });

  it('handles dotfile config that is an array gracefully', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(dotDir, 'config.json'), '[]');
    const result = resolveSemanticConfig(tempDir, { anthropicKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.anthropicApiKey).toBe('test-key');
  });
});
