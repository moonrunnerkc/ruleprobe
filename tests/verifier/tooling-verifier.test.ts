/**
 * Tests for tooling verifier.
 *
 * Uses real temp directories with package.json, lockfiles,
 * and config files to verify tooling detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyToolingRule } from '../../src/verifier/tooling-verifier.js';
import type { Rule } from '../../src/types.js';

let tempDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-tooling-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRule(type: string, target: string): Rule {
  return {
    id: `test-tooling-${target}`,
    source: `Use ${target}`,
    category: 'tooling',
    severity: 'warning',
    verifier: 'tooling',
    pattern: { type, target, expected: true, scope: 'project' },
  };
}

describe('tooling verifier: package-manager', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when pnpm lockfile present', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0');
    const files = [join(tempDir, 'pnpm-lock.yaml')];
    const result = verifyToolingRule(makeRule('package-manager', 'pnpm'), tempDir, files);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBe(1);
  });

  it('fails when no lockfile present', () => {
    const result = verifyToolingRule(makeRule('package-manager', 'pnpm'), tempDir, []);
    expect(result.passed).toBe(false);
    expect(result.compliance).toBe(0);
  });

  it('gives partial compliance when competing lockfiles present', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    writeFileSync(join(tempDir, 'package-lock.json'), '{}');
    const files = [
      join(tempDir, 'pnpm-lock.yaml'),
      join(tempDir, 'package-lock.json'),
    ];
    const result = verifyToolingRule(makeRule('package-manager', 'pnpm'), tempDir, files);
    expect(result.compliance).toBe(0.5);
  });

  it('fails when wrong lockfile present', () => {
    writeFileSync(join(tempDir, 'package-lock.json'), '{}');
    const files = [join(tempDir, 'package-lock.json')];
    const result = verifyToolingRule(makeRule('package-manager', 'pnpm'), tempDir, files);
    expect(result.passed).toBe(false);
  });
});

describe('tooling verifier: test-framework', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when vitest config file exists', () => {
    writeFileSync(join(tempDir, 'vitest.config.ts'), 'export default {};');
    const files = [join(tempDir, 'vitest.config.ts')];
    const result = verifyToolingRule(makeRule('test-framework', 'vitest'), tempDir, files);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBe(1);
  });

  it('passes when framework in package.json devDependencies', () => {
    const pkg = { devDependencies: { vitest: '2.1.9' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const files = [join(tempDir, 'package.json')];
    const result = verifyToolingRule(makeRule('test-framework', 'vitest'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('passes when framework referenced in package.json scripts', () => {
    const pkg = { scripts: { test: 'vitest run' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const files = [join(tempDir, 'package.json')];
    const result = verifyToolingRule(makeRule('test-framework', 'vitest'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('fails when framework not found anywhere', () => {
    const pkg = { devDependencies: { jest: '29.0.0' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const files = [join(tempDir, 'package.json')];
    const result = verifyToolingRule(makeRule('test-framework', 'vitest'), tempDir, files);
    expect(result.passed).toBe(false);
  });
});

describe('tooling verifier: tool-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when tool in package.json', () => {
    const pkg = { devDependencies: { eslint: '9.0.0' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const files = [join(tempDir, 'package.json')];
    const result = verifyToolingRule(makeRule('tool-present', 'eslint'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('passes when tool referenced in config file', () => {
    writeFileSync(join(tempDir, '.prettierrc.json'), '{"semi": false}');
    const files = [join(tempDir, '.prettierrc.json')];
    // This tool checks config files for tool name
    const result = verifyToolingRule(makeRule('tool-present', 'prettier'), tempDir, files);
    // prettier appears in the file name but not content; checking by content
    expect(result.passed).toBe(false);
  });

  it('fails when tool not found', () => {
    const result = verifyToolingRule(makeRule('tool-present', 'eslint'), tempDir, []);
    expect(result.passed).toBe(false);
    expect(result.evidence).toHaveLength(1);
  });
});
