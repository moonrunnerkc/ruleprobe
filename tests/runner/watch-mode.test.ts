// Tests for watch-mode utilities: file completion polling and code-file counting.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { watchForCompletion, countCodeFiles } from '../../src/runner/watch-mode.js';

describe('watchForCompletion', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-watch-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves immediately if .done marker already exists', async () => {
    writeFileSync(join(tempDir, '.done'), '');

    const result = await watchForCompletion({
      watchDir: tempDir,
      timeoutSeconds: 5,
      pollIntervalMs: 50,
    });

    expect(result.completed).toBe(true);
    expect(result.reason).toBe('done-marker');
    expect(result.durationSeconds).toBeLessThan(1);
  });

  it('detects .done marker created after polling starts', async () => {
    // Create .done after 100ms
    setTimeout(() => {
      writeFileSync(join(tempDir, '.done'), '');
    }, 100);

    const result = await watchForCompletion({
      watchDir: tempDir,
      timeoutSeconds: 5,
      pollIntervalMs: 50,
    });

    expect(result.completed).toBe(true);
    expect(result.reason).toBe('done-marker');
  });

  it('times out when .done marker never appears', async () => {
    const result = await watchForCompletion({
      watchDir: tempDir,
      timeoutSeconds: 0.2,
      pollIntervalMs: 50,
    });

    expect(result.completed).toBe(false);
    expect(result.reason).toBe('timeout');
  });
});

describe('countCodeFiles', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-count-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns 0 for empty directory', () => {
    expect(countCodeFiles(tempDir)).toBe(0);
  });

  it('returns 0 for nonexistent directory', () => {
    expect(countCodeFiles('/tmp/nonexistent-ruleprobe-dir')).toBe(0);
  });

  it('counts TypeScript files', () => {
    writeFileSync(join(tempDir, 'index.ts'), 'export const x = 1;');
    writeFileSync(join(tempDir, 'app.tsx'), 'export const App = () => null;');
    expect(countCodeFiles(tempDir)).toBe(2);
  });

  it('counts JavaScript files', () => {
    writeFileSync(join(tempDir, 'main.js'), 'module.exports = {};');
    writeFileSync(join(tempDir, 'comp.jsx'), 'const x = 1;');
    expect(countCodeFiles(tempDir)).toBe(2);
  });

  it('counts Python and Go files', () => {
    writeFileSync(join(tempDir, 'app.py'), 'print("hello")');
    writeFileSync(join(tempDir, 'main.go'), 'package main');
    expect(countCodeFiles(tempDir)).toBe(2);
  });

  it('ignores non-code files', () => {
    writeFileSync(join(tempDir, 'readme.md'), '# Hi');
    writeFileSync(join(tempDir, 'data.json'), '{}');
    writeFileSync(join(tempDir, 'style.css'), 'body {}');
    expect(countCodeFiles(tempDir)).toBe(0);
  });

  it('recurses into subdirectories', () => {
    const sub = join(tempDir, 'src');
    mkdirSync(sub);
    writeFileSync(join(tempDir, 'index.ts'), 'export {};');
    writeFileSync(join(sub, 'util.ts'), 'export {};');
    expect(countCodeFiles(tempDir)).toBe(2);
  });

  it('skips node_modules and dotfiles', () => {
    const nm = join(tempDir, 'node_modules');
    mkdirSync(nm);
    writeFileSync(join(nm, 'dep.js'), '');
    const dot = join(tempDir, '.hidden');
    mkdirSync(dot);
    writeFileSync(join(dot, 'secret.ts'), '');
    expect(countCodeFiles(tempDir)).toBe(0);
  });
});
