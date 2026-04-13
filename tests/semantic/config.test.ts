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
    originalEnv['RULEPROBE_LICENSE_KEY'] = process.env['RULEPROBE_LICENSE_KEY'];
    originalEnv['RULEPROBE_API_ENDPOINT'] = process.env['RULEPROBE_API_ENDPOINT'];
    delete process.env['RULEPROBE_LICENSE_KEY'];
    delete process.env['RULEPROBE_API_ENDPOINT'];
  });

  afterEach(() => {
    if (originalEnv['RULEPROBE_LICENSE_KEY'] !== undefined) {
      process.env['RULEPROBE_LICENSE_KEY'] = originalEnv['RULEPROBE_LICENSE_KEY'];
    } else {
      delete process.env['RULEPROBE_LICENSE_KEY'];
    }
    if (originalEnv['RULEPROBE_API_ENDPOINT'] !== undefined) {
      process.env['RULEPROBE_API_ENDPOINT'] = originalEnv['RULEPROBE_API_ENDPOINT'];
    } else {
      delete process.env['RULEPROBE_API_ENDPOINT'];
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no license key is available', () => {
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).toBeNull();
  });

  it('resolves license key from CLI flag first', () => {
    process.env['RULEPROBE_LICENSE_KEY'] = 'env-key';
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'cli-key' });
    expect(result).not.toBeNull();
    expect(result!.licenseKey).toBe('cli-key');
  });

  it('resolves license key from env var when CLI flag missing', () => {
    process.env['RULEPROBE_LICENSE_KEY'] = 'env-key';
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).not.toBeNull();
    expect(result!.licenseKey).toBe('env-key');
  });

  it('resolves license key from dotfile config when CLI and env are missing', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(
      join(dotDir, 'config.json'),
      JSON.stringify({ licenseKey: 'dotfile-key' }),
    );
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).not.toBeNull();
    expect(result!.licenseKey).toBe('dotfile-key');
  });

  it('uses default API endpoint when none is configured', () => {
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.apiEndpoint).toBe('http://localhost:3000');
  });

  it('resolves API endpoint from env var', () => {
    process.env['RULEPROBE_API_ENDPOINT'] = 'https://custom.api.dev';
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.apiEndpoint).toBe('https://custom.api.dev');
  });

  it('resolves API endpoint from dotfile when env var is missing', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(
      join(dotDir, 'config.json'),
      JSON.stringify({
        licenseKey: 'dotfile-key',
        apiEndpoint: 'https://dotfile.api.dev',
      }),
    );
    const result = resolveSemanticConfig(tempDir, {});
    expect(result).not.toBeNull();
    expect(result!.apiEndpoint).toBe('https://dotfile.api.dev');
  });

  it('env var API endpoint overrides dotfile API endpoint', () => {
    process.env['RULEPROBE_API_ENDPOINT'] = 'https://env.api.dev';
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(
      join(dotDir, 'config.json'),
      JSON.stringify({
        licenseKey: 'dotfile-key',
        apiEndpoint: 'https://dotfile.api.dev',
      }),
    );
    const result = resolveSemanticConfig(tempDir, {});
    expect(result!.apiEndpoint).toBe('https://env.api.dev');
  });

  it('sets default maxLlmCalls when CLI does not override', () => {
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result!.maxLlmCalls).toBe(20);
  });

  it('overrides maxLlmCalls from CLI', () => {
    const result = resolveSemanticConfig(tempDir, {
      licenseKey: 'test-key',
      maxLlmCalls: 5,
    });
    expect(result!.maxLlmCalls).toBe(5);
  });

  it('sets useCache to true by default', () => {
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result!.useCache).toBe(true);
  });

  it('sets useCache to false when noCache is true', () => {
    const result = resolveSemanticConfig(tempDir, {
      licenseKey: 'test-key',
      noCache: true,
    });
    expect(result!.useCache).toBe(false);
  });

  it('sets default fastPathThreshold', () => {
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result!.fastPathThreshold).toBe(0.85);
  });

  it('handles malformed dotfile config gracefully', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(dotDir, 'config.json'), 'not json');
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.licenseKey).toBe('test-key');
  });

  it('handles dotfile config that is an array gracefully', () => {
    const dotDir = join(tempDir, '.ruleprobe');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(dotDir, 'config.json'), '[]');
    const result = resolveSemanticConfig(tempDir, { licenseKey: 'test-key' });
    expect(result).not.toBeNull();
    expect(result!.licenseKey).toBe('test-key');
  });
});
