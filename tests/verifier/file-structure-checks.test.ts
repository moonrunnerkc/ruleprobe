/**
 * Tests for file-structure verification checks.
 *
 * Uses real temp directories to verify directory existence,
 * file pattern existence, module index checks, and test colocation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkDirectoryExistsWithFiles,
  checkFilePatternExists,
  checkModuleIndexRequired,
  checkTestColocation,
} from '../../src/verifier/file-structure-checks.js';

let tempDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('checkDirectoryExistsWithFiles', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when directory exists with files', () => {
    const srcDir = join(tempDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    const filePath = join(srcDir, 'index.ts');
    writeFileSync(filePath, 'export {};');

    const files = [filePath];
    const evidence = checkDirectoryExistsWithFiles(files, tempDir, 'src');
    expect(evidence).toHaveLength(0);
  });

  it('fails when directory does not exist', () => {
    const evidence = checkDirectoryExistsWithFiles([], tempDir, 'src');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.found).toContain('does not exist');
  });

  it('fails when directory exists but is empty', () => {
    const srcDir = join(tempDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    const evidence = checkDirectoryExistsWithFiles([], tempDir, 'src');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.found).toContain('empty');
  });
});

describe('checkFilePatternExists', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when file exists', () => {
    const envFile = join(tempDir, '.env');
    writeFileSync(envFile, 'KEY=value');
    const files = [envFile];
    const evidence = checkFilePatternExists(files, tempDir, '.env');
    expect(evidence).toHaveLength(0);
  });

  it('fails when file not found', () => {
    const evidence = checkFilePatternExists([], tempDir, '.env');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.found).toContain('not found');
  });

  it('matches file by basename', () => {
    const nested = join(tempDir, 'config', '.env.local');
    mkdirSync(join(tempDir, 'config'), { recursive: true });
    writeFileSync(nested, 'KEY=value');
    const files = [nested];
    const evidence = checkFilePatternExists(files, tempDir, '.env.local');
    expect(evidence).toHaveLength(0);
  });
});

describe('checkModuleIndexRequired', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('returns compliance 1 when all dirs have index.ts', () => {
    const utils = join(tempDir, 'utils');
    mkdirSync(utils, { recursive: true });
    writeFileSync(join(utils, 'index.ts'), 'export {};');
    writeFileSync(join(utils, 'helpers.ts'), 'export const x = 1;');

    const files = [
      join(utils, 'index.ts'),
      join(utils, 'helpers.ts'),
    ];

    const result = checkModuleIndexRequired(files, tempDir, 'index.ts');
    expect(result.compliance).toBe(1);
    expect(result.evidence).toHaveLength(0);
  });

  it('returns compliance 0 when no dir has index.ts', () => {
    const utils = join(tempDir, 'utils');
    mkdirSync(utils, { recursive: true });
    writeFileSync(join(utils, 'helpers.ts'), 'export const x = 1;');

    const files = [join(utils, 'helpers.ts')];

    const result = checkModuleIndexRequired(files, tempDir, 'index.ts');
    expect(result.compliance).toBe(0);
    expect(result.evidence).toHaveLength(1);
  });

  it('returns partial compliance for mixed directories', () => {
    const mod1 = join(tempDir, 'mod1');
    const mod2 = join(tempDir, 'mod2');
    mkdirSync(mod1, { recursive: true });
    mkdirSync(mod2, { recursive: true });

    writeFileSync(join(mod1, 'index.ts'), 'export {};');
    writeFileSync(join(mod1, 'a.ts'), 'export const a = 1;');
    writeFileSync(join(mod2, 'b.ts'), 'export const b = 2;');

    const files = [
      join(mod1, 'index.ts'),
      join(mod1, 'a.ts'),
      join(mod2, 'b.ts'),
    ];

    const result = checkModuleIndexRequired(files, tempDir, 'index.ts');
    expect(result.compliance).toBe(0.5);
    expect(result.evidence).toHaveLength(1);
  });

  it('returns compliance 1 when no module directories found', () => {
    const result = checkModuleIndexRequired([], tempDir, 'index.ts');
    expect(result.compliance).toBe(1);
  });
});

describe('checkTestColocation', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('returns compliance 1 when all source files have tests', () => {
    const src = join(tempDir, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'utils.ts'), 'export const x = 1;');
    writeFileSync(join(src, 'utils.test.ts'), 'test("x", () => {});');

    const files = [
      join(src, 'utils.ts'),
      join(src, 'utils.test.ts'),
    ];

    const result = checkTestColocation(files, tempDir);
    expect(result.compliance).toBe(1);
    expect(result.evidence).toHaveLength(0);
  });

  it('returns compliance 0 when no source files have tests', () => {
    const src = join(tempDir, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'utils.ts'), 'export const x = 1;');
    writeFileSync(join(src, 'helpers.ts'), 'export const y = 2;');

    const files = [
      join(src, 'utils.ts'),
      join(src, 'helpers.ts'),
    ];

    const result = checkTestColocation(files, tempDir);
    expect(result.compliance).toBe(0);
    expect(result.evidence).toHaveLength(2);
  });

  it('finds tests in __tests__ subdirectory', () => {
    const src = join(tempDir, 'src');
    const tests = join(src, '__tests__');
    mkdirSync(tests, { recursive: true });
    writeFileSync(join(src, 'utils.ts'), 'export const x = 1;');
    writeFileSync(join(tests, 'utils.test.ts'), 'test("x", () => {});');

    const files = [
      join(src, 'utils.ts'),
      join(tests, 'utils.test.ts'),
    ];

    const result = checkTestColocation(files, tempDir);
    expect(result.compliance).toBe(1);
  });

  it('returns partial compliance for mixed', () => {
    const src = join(tempDir, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.ts'), 'export const a = 1;');
    writeFileSync(join(src, 'b.ts'), 'export const b = 2;');
    writeFileSync(join(src, 'a.test.ts'), 'test("a", () => {});');

    const files = [
      join(src, 'a.ts'),
      join(src, 'b.ts'),
      join(src, 'a.test.ts'),
    ];

    const result = checkTestColocation(files, tempDir);
    expect(result.compliance).toBe(0.5);
    expect(result.evidence).toHaveLength(1);
  });

  it('returns compliance 1 when no source files exist', () => {
    const result = checkTestColocation([], tempDir);
    expect(result.compliance).toBe(1);
  });
});
