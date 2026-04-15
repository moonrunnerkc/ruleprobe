/**
 * Tests for config-file verifier.
 *
 * Uses real temp directories with CI configs, git hooks,
 * package.json scripts, and environment tool manifests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyConfigFileRule } from '../../src/verifier/config-file-verifier.js';
import type { Rule } from '../../src/types.js';

let tempDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRule(type: string, target: string): Rule {
  return {
    id: `test-config-${target}`,
    source: `Config file rule: ${target}`,
    category: 'workflow',
    severity: 'warning',
    verifier: 'config-file',
    pattern: { type, target, expected: true, scope: 'project' },
    description: `Config rule for ${target}`,
  };
}

describe('config-file verifier: ci-command-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when CI workflow contains the command', () => {
    const workflowDir = join(tempDir, '.github', 'workflows');
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, 'ci.yml'), 'jobs:\n  build:\n    steps:\n      - run: npm test\n');
    const files = [join(workflowDir, 'ci.yml')];
    const result = verifyConfigFileRule(makeRule('ci-command-present', 'test'), tempDir, files);
    expect(result.passed).toBe(true);
    expect(result.compliance).toBe(1);
  });

  it('fails when CI workflow does not contain the command', () => {
    const workflowDir = join(tempDir, '.github', 'workflows');
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, 'ci.yml'), 'jobs:\n  build:\n    steps:\n      - run: npm build\n');
    const files = [join(workflowDir, 'ci.yml')];
    const result = verifyConfigFileRule(makeRule('ci-command-present', 'lint'), tempDir, files);
    expect(result.passed).toBe(false);
    expect(result.compliance).toBe(0);
  });

  it('fails when no CI files exist', () => {
    const result = verifyConfigFileRule(makeRule('ci-command-present', 'test'), tempDir, []);
    expect(result.passed).toBe(false);
  });
});

describe('config-file verifier: git-hook-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when husky pre-commit hook exists', () => {
    const huskyDir = join(tempDir, '.husky');
    mkdirSync(huskyDir, { recursive: true });
    writeFileSync(join(huskyDir, 'pre-commit'), '#!/bin/sh\nnpm test\n');
    const result = verifyConfigFileRule(makeRule('git-hook-present', 'pre-commit'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('passes when lefthook config references the hook', () => {
    writeFileSync(join(tempDir, 'lefthook.yml'), 'pre-commit:\n  commands:\n    lint:\n      run: npm run lint\n');
    const result = verifyConfigFileRule(makeRule('git-hook-present', 'pre-commit'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('passes when package.json has lint-staged (implies pre-commit)', () => {
    const pkg = { 'lint-staged': { '*.ts': ['eslint --fix'] } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = verifyConfigFileRule(makeRule('git-hook-present', 'pre-commit'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('fails when no hook configuration found', () => {
    const result = verifyConfigFileRule(makeRule('git-hook-present', 'pre-commit'), tempDir, []);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

describe('config-file verifier: script-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when script exists in package.json', () => {
    const pkg = { scripts: { test: 'vitest run' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = verifyConfigFileRule(makeRule('script-present', 'test'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('fails when script missing from package.json', () => {
    const pkg = { scripts: { build: 'tsc' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = verifyConfigFileRule(makeRule('script-present', 'lint'), tempDir, []);
    expect(result.passed).toBe(false);
  });

  it('fails when package.json does not exist', () => {
    const result = verifyConfigFileRule(makeRule('script-present', 'test'), tempDir, []);
    expect(result.passed).toBe(false);
  });
});

describe('config-file verifier: env-tool-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when flox manifest exists', () => {
    const floxDir = join(tempDir, '.flox');
    mkdirSync(floxDir, { recursive: true });
    writeFileSync(join(floxDir, 'env.toml'), '[install]\nnodejs.pkg-path = "nodejs"\n');
    const files = [join(floxDir, 'env.toml')];
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'flox'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('passes when nix flake exists', () => {
    writeFileSync(join(tempDir, 'flake.nix'), '{ outputs = ... }');
    const files = [join(tempDir, 'flake.nix')];
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'nix'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('passes when volta config in package.json', () => {
    const pkg = { volta: { node: '20.11.0' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'volta'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('passes when devcontainer.json exists', () => {
    const dcDir = join(tempDir, '.devcontainer');
    mkdirSync(dcDir, { recursive: true });
    writeFileSync(join(dcDir, 'devcontainer.json'), '{"name": "test"}');
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'devcontainer'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('falls back to config file content search', () => {
    writeFileSync(join(tempDir, 'config.yml'), 'tool: mise\nversion: 1.0\n');
    const files = [join(tempDir, 'config.yml')];
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'mise'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('fails when tool not found', () => {
    const result = verifyConfigFileRule(makeRule('env-tool-present', 'flox'), tempDir, []);
    expect(result.passed).toBe(false);
  });
});

describe('config-file verifier: ci-config-present', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when GitHub workflows directory exists', () => {
    const workflowDir = join(tempDir, '.github', 'workflows');
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, 'ci.yml'), 'on: push');
    const files = [join(workflowDir, 'ci.yml')];
    const result = verifyConfigFileRule(makeRule('ci-config-present', 'ci'), tempDir, files);
    expect(result.passed).toBe(true);
  });

  it('passes when gitlab-ci.yml exists', () => {
    writeFileSync(join(tempDir, '.gitlab-ci.yml'), 'stages: [build]');
    const result = verifyConfigFileRule(makeRule('ci-config-present', 'ci'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('fails when no CI config found', () => {
    const result = verifyConfigFileRule(makeRule('ci-config-present', 'ci'), tempDir, []);
    expect(result.passed).toBe(false);
  });
});

describe('config-file verifier: pre-commit-check', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('passes when husky pre-commit runs the command', () => {
    const huskyDir = join(tempDir, '.husky');
    mkdirSync(huskyDir, { recursive: true });
    writeFileSync(join(huskyDir, 'pre-commit'), '#!/bin/sh\nnpm test\n');
    const result = verifyConfigFileRule(makeRule('pre-commit-check', 'test'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('passes when lefthook pre-commit section runs the command', () => {
    writeFileSync(
      join(tempDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    check:\n      run: npm run lint\n',
    );
    const result = verifyConfigFileRule(makeRule('pre-commit-check', 'lint'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('passes when lint-staged in package.json runs the command', () => {
    const pkg = { 'lint-staged': { '*.ts': ['eslint'] } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));
    const result = verifyConfigFileRule(makeRule('pre-commit-check', 'eslint'), tempDir, []);
    expect(result.passed).toBe(true);
  });

  it('fails when pre-commit does not run the command', () => {
    const huskyDir = join(tempDir, '.husky');
    mkdirSync(huskyDir, { recursive: true });
    writeFileSync(join(huskyDir, 'pre-commit'), '#!/bin/sh\nnpm run build\n');
    const result = verifyConfigFileRule(makeRule('pre-commit-check', 'test'), tempDir, []);
    expect(result.passed).toBe(false);
  });
});
