// Tests for type-aware AST checks using ts-morph type resolution.
// Covers implicit-any, unused-variables, and type-assertion detection.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Project } from 'ts-morph';
import { checkImplicitAny, checkUnusedExports, checkUnresolvedImports } from '../../src/ast-checks/type-aware.js';

describe('checkImplicitAny', () => {
  let tempDir: string;
  let project: Project;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-typeaware-'));
    writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        noImplicitAny: true,
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node',
      },
    }));

    // File with implicit any
    writeFileSync(join(tempDir, 'implicit.ts'), `
function greet(name) {
  return name;
}
let value;
`);

    // File without implicit any
    writeFileSync(join(tempDir, 'explicit.ts'), `
function greet(name: string): string {
  return name;
}
const value: number = 42;
`);

    project = new Project({ tsConfigFilePath: join(tempDir, 'tsconfig.json') });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects implicit any on parameters', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'implicit.ts'));
    const evidence = checkImplicitAny(sourceFile, join(tempDir, 'implicit.ts'), project);

    const paramEvidence = evidence.filter((e) => e.found.includes('parameter'));
    expect(paramEvidence.length).toBeGreaterThan(0);
    expect(paramEvidence[0].found).toContain('name');
  });

  it('finds no implicit any in fully typed code', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'explicit.ts'));
    const evidence = checkImplicitAny(sourceFile, join(tempDir, 'explicit.ts'), project);
    expect(evidence).toHaveLength(0);
  });
});

describe('checkUnusedExports', () => {
  let tempDir: string;
  let project: Project;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-unused-exports-'));
    writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node',
      },
      include: ['*.ts'],
    }));

    // Module with an unused export
    writeFileSync(join(tempDir, 'utils.ts'), `
export function usedFn(): string { return 'used'; }
export function unusedFn(): string { return 'unused'; }
`);

    // Consumer that only imports usedFn
    writeFileSync(join(tempDir, 'main.ts'), `
import { usedFn } from './utils.js';
console.log(usedFn());
`);

    project = new Project({ tsConfigFilePath: join(tempDir, 'tsconfig.json') });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects exports with no external references', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'utils.ts'));
    const evidence = checkUnusedExports(
      sourceFile,
      join(tempDir, 'utils.ts'),
      project,
    );

    const unusedNames = evidence.map((e) => e.found);
    expect(unusedNames.some((n) => n.includes('unusedFn'))).toBe(true);
  });

  it('does not flag exports that are imported elsewhere', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'utils.ts'));
    const evidence = checkUnusedExports(
      sourceFile,
      join(tempDir, 'utils.ts'),
      project,
    );

    // Only unusedFn should appear; usedFn is imported by main.ts
    const names = evidence.map((e) => e.found);
    expect(names.every((n) => !n.includes('"usedFn"'))).toBe(true);
  });
});

describe('checkUnresolvedImports', () => {
  let tempDir: string;
  let project: Project;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-unresolved-'));
    writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node',
      },
      include: ['*.ts'],
    }));

    // File with a broken relative import
    writeFileSync(join(tempDir, 'broken.ts'), `
import { something } from './nonexistent.js';
export const x = 1;
`);

    // File with only valid imports
    writeFileSync(join(tempDir, 'valid.ts'), `
export const y = 2;
`);

    project = new Project({ tsConfigFilePath: join(tempDir, 'tsconfig.json') });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects unresolvable relative imports', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'broken.ts'));
    const evidence = checkUnresolvedImports(
      sourceFile,
      join(tempDir, 'broken.ts'),
      project,
    );

    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].found).toContain('nonexistent');
  });

  it('does not flag files without broken imports', () => {
    const sourceFile = project.getSourceFileOrThrow(join(tempDir, 'valid.ts'));
    const evidence = checkUnresolvedImports(
      sourceFile,
      join(tempDir, 'valid.ts'),
      project,
    );

    expect(evidence).toHaveLength(0);
  });
});
