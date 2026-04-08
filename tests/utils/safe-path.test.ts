// Tests for safe path resolution and directory walking with symlink protection.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveSafePath, walkDirectorySafe } from '../../src/utils/safe-path.js';

describe('resolveSafePath', () => {
  let testDir: string;
  let insideDir: string;
  let outsideDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'ruleprobe-safe-'));
    insideDir = join(testDir, 'project');
    outsideDir = mkdtempSync(join(tmpdir(), 'ruleprobe-outside-'));
    mkdirSync(insideDir, { recursive: true });
    writeFileSync(join(insideDir, 'file.ts'), 'export const x = 1;\n');
    writeFileSync(join(outsideDir, 'secret.txt'), 'sensitive data\n');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('accepts a path resolving inside cwd', () => {
    const result = resolveSafePath('project/file.ts', testDir);
    expect(result).toBe(join(insideDir, 'file.ts'));
  });

  it('accepts cwd itself as a valid path', () => {
    const result = resolveSafePath('.', testDir);
    expect(result).toBe(testDir);
  });

  it('throws for a path resolving outside cwd', () => {
    expect(() => resolveSafePath('../../etc/passwd', testDir)).toThrow(
      /outside the working directory/,
    );
  });

  it('rejects a symlink to a file outside cwd', () => {
    const linkPath = join(insideDir, 'escape-link');
    symlinkSync(join(outsideDir, 'secret.txt'), linkPath);

    expect(() => resolveSafePath('project/escape-link', testDir)).toThrow(
      /outside the working directory/,
    );
  });

  it('follows a symlink to a file inside cwd', () => {
    const targetFile = join(insideDir, 'file.ts');
    const linkPath = join(insideDir, 'local-link.ts');
    symlinkSync(targetFile, linkPath);

    const result = resolveSafePath('project/local-link.ts', testDir);
    expect(result).toBe(targetFile);
  });

  it('includes remedy suggestion in error message', () => {
    expect(() => resolveSafePath('/etc/passwd', testDir)).toThrow(
      /--allow-symlinks/,
    );
  });
});

describe('walkDirectorySafe', () => {
  let testDir: string;
  let outsideDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'ruleprobe-walk-'));
    outsideDir = mkdtempSync(join(tmpdir(), 'ruleprobe-walkout-'));

    // Create a directory structure
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export {};\n');
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export {};\n');

    // Create an external file and a symlink pointing to it
    writeFileSync(join(outsideDir, 'external.ts'), 'export {};\n');
    symlinkSync(
      join(outsideDir, 'external.ts'),
      join(testDir, 'src', 'linked-external.ts'),
    );

    // Create a symlink to an internal file
    symlinkSync(
      join(testDir, 'src', 'index.ts'),
      join(testDir, 'src', 'linked-internal.ts'),
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('skips symlinks and warns when allowSymlinks is false', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const files = walkDirectorySafe(testDir, false);

    // Only real files should be included
    const basenames = files.map((f) => f.split('/').pop());
    expect(basenames).toContain('index.ts');
    expect(basenames).toContain('utils.ts');
    expect(basenames).not.toContain('linked-external.ts');
    expect(basenames).not.toContain('linked-internal.ts');

    // Warnings should have been written for skipped symlinks
    const warnings = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('skipping symlink'))).toBe(true);

    stderrSpy.mockRestore();
  });

  it('follows symlinks when allowSymlinks is true', () => {
    const files = walkDirectorySafe(testDir, true);

    const basenames = files.map((f) => f.split('/').pop());
    expect(basenames).toContain('index.ts');
    expect(basenames).toContain('utils.ts');
    expect(basenames).toContain('linked-external.ts');
    expect(basenames).toContain('linked-internal.ts');
  });

  it('skips node_modules and hidden directories', () => {
    mkdirSync(join(testDir, 'node_modules'), { recursive: true });
    writeFileSync(join(testDir, 'node_modules', 'dep.js'), '');
    mkdirSync(join(testDir, '.hidden'), { recursive: true });
    writeFileSync(join(testDir, '.hidden', 'secret.ts'), '');

    const files = walkDirectorySafe(testDir, false);
    const paths = files.join(' ');
    expect(paths).not.toContain('node_modules');
    expect(paths).not.toContain('.hidden');
  });
});
