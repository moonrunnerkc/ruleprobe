/**
 * Tests for the single-pass local AST extractor.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractRawVectors } from '../../src/semantic/local-extractor.js';
import { walkSourceFiles, isTestFile } from '../../src/semantic/file-walker.js';
import { sha256 } from '../../src/semantic/ast-visitor.js';

const FIXTURE_DIR = resolve(__dirname, 'fixtures/sample-project');

describe('walkSourceFiles', () => {
  it('discovers TS and JS files in the fixture directory', () => {
    const files = walkSourceFiles(FIXTURE_DIR);
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.some((f) => f.endsWith('.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
  });

  it('excludes node_modules directories', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-walk-'));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    mkdirSync(join(tempDir, 'node_modules/pkg'), { recursive: true });
    writeFileSync(join(tempDir, 'src/a.ts'), 'const x = 1;');
    writeFileSync(join(tempDir, 'node_modules/pkg/b.ts'), 'const y = 2;');

    const files = walkSourceFiles(tempDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain('a.ts');

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns files in sorted order for determinism', () => {
    const files = walkSourceFiles(FIXTURE_DIR);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });
});

describe('isTestFile', () => {
  it('identifies files in test directories', () => {
    expect(isTestFile('/project/tests/foo.ts')).toBe(true);
    expect(isTestFile('/project/__tests__/bar.ts')).toBe(true);
  });

  it('identifies files with test suffixes', () => {
    expect(isTestFile('/project/src/math.test.ts')).toBe(true);
    expect(isTestFile('/project/src/utils.spec.js')).toBe(true);
  });

  it('rejects regular source files', () => {
    expect(isTestFile('/project/src/math.ts')).toBe(false);
    expect(isTestFile('/project/src/utils.js')).toBe(false);
  });
});

describe('extractRawVectors', () => {
  it('produces a payload with opaque sequential file identifiers', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const keys = Object.keys(payload.fileVectors);

    expect(keys.length).toBeGreaterThanOrEqual(3);

    for (const key of keys) {
      expect(key).toMatch(/^\d+$/);
      expect(key).not.toContain('/');
      expect(key).not.toContain('.');
      expect(key).not.toContain('src');
    }
  });

  it('opaque identifiers contain no file path information', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain('sample-project');
    expect(serialized).not.toContain('math.ts');
    expect(serialized).not.toContain('user.ts');
    expect(serialized).not.toContain('greet.js');
    expect(serialized).not.toContain('/src/');
    expect(serialized).not.toContain('/tests/');
  });

  it('counts AST node types for TypeScript files', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const vectors = Object.values(payload.fileVectors);
    const hasNodeTypes = vectors.some(
      (v) => Object.keys(v.nodeTypeCounts).length > 1,
    );
    expect(hasNodeTypes).toBe(true);
  });

  it('computes nesting depths for relevant node types', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const vectors = Object.values(payload.fileVectors);
    const hasDepths = vectors.some(
      (v) => Object.keys(v.nestingDepths).length > 0,
    );
    expect(hasDepths).toBe(true);
  });

  it('produces sub-tree hashes', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const vectors = Object.values(payload.fileVectors);
    const hasHashes = vectors.some((v) => v.subTreeHashes.length > 0);
    expect(hasHashes).toBe(true);
  });

  it('sets the deviation comment flag for files with TODO comments', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const vectors = Object.values(payload.fileVectors);
    const hasDeviation = vectors.some(
      (v) => v.nodeTypeCounts['__flag:deviationComment'] === 1,
    );
    expect(hasDeviation).toBe(true);
  });

  it('sets the test code flag for files in test directories', async () => {
    const payload = await extractRawVectors(FIXTURE_DIR);
    const vectors = Object.values(payload.fileVectors);
    const hasTestFlag = vectors.some(
      (v) => v.nodeTypeCounts['__flag:testCode'] === 1,
    );
    expect(hasTestFlag).toBe(true);
  });

  it('produces a deterministic extraction hash', async () => {
    const payload1 = await extractRawVectors(FIXTURE_DIR);
    const payload2 = await extractRawVectors(FIXTURE_DIR);
    expect(payload1.extractionHash).toBe(payload2.extractionHash);
    expect(payload1.extractionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('extraction hash changes when file content changes', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-hash-'));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src/a.ts'), 'const x = 1;');

    const payload1 = await extractRawVectors(tempDir);
    writeFileSync(join(tempDir, 'src/a.ts'), 'const x = 2;');
    const payload2 = await extractRawVectors(tempDir);

    expect(payload1.extractionHash).not.toBe(payload2.extractionHash);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles directories with many files without timeout', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-scale-'));
    mkdirSync(join(tempDir, 'src'), { recursive: true });

    for (let i = 0; i < 500; i++) {
      writeFileSync(
        join(tempDir, `src/file-${i}.ts`),
        `export const value${i} = ${i};\n`,
      );
    }

    const start = Date.now();
    const payload = await extractRawVectors(tempDir);
    const elapsed = Date.now() - start;

    expect(Object.keys(payload.fileVectors).length).toBe(500);
    expect(elapsed).toBeLessThan(60000);

    rmSync(tempDir, { recursive: true, force: true });
  }, 120000);
});

describe('sha256', () => {
  it('produces consistent hashes', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('produces 64-char hex strings', () => {
    expect(sha256('test')).toMatch(/^[a-f0-9]{64}$/);
  });
});
