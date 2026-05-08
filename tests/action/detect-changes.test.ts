/**
 * Tests for the detect-changes module.
 *
 * Validates that drift detection correctly identifies relevant file
 * changes and skips when only unrelated files are modified.
 */

import { describe, it, expect } from 'vitest';
import { shouldRunDrift, autoDetectEslintFile } from '../../src/action/detect-changes.js';

describe('shouldRunDrift', () => {
  it('returns true when CLAUDE.md is changed', () => {
    expect(shouldRunDrift(['src/index.ts', 'CLAUDE.md', 'package.json'])).toBe(true);
  });

  it('returns true when AGENTS.md is changed', () => {
    expect(shouldRunDrift(['src/verifiers/ast.ts', 'AGENTS.md'])).toBe(true);
  });

  it('returns true when .cursorrules is changed', () => {
    expect(shouldRunDrift(['.cursorrules', 'src/main.ts'])).toBe(true);
  });

  it('returns true when a nested instruction file is changed', () => {
    expect(shouldRunDrift(['packages/app/CLAUDE.md', 'src/app.ts'])).toBe(true);
  });

  it('returns true when .eslintrc.json is changed', () => {
    expect(shouldRunDrift(['.eslintrc.json', 'src/util.ts'])).toBe(true);
  });

  it('returns true when eslint.config.js is changed', () => {
    expect(shouldRunDrift(['eslint.config.js'])).toBe(true);
  });

  it('returns true when eslint.config.mjs is changed', () => {
    expect(shouldRunDrift(['eslint.config.mjs', 'README.md'])).toBe(true);
  });

  it('returns true when .eslintrc.js is changed', () => {
    expect(shouldRunDrift(['.eslintrc.js'])).toBe(true);
  });

  it('returns true when .eslintrc.cjs is changed', () => {
    expect(shouldRunDrift(['.eslintrc.cjs'])).toBe(true);
  });

  it('returns true when .eslintrc.yml is changed', () => {
    expect(shouldRunDrift(['.eslintrc.yml'])).toBe(true);
  });

  it('returns true when eslint.config.ts is changed', () => {
    expect(shouldRunDrift(['eslint.config.ts'])).toBe(true);
  });

  it('returns false when only source files are changed', () => {
    expect(shouldRunDrift(['src/index.ts', 'src/util.ts', 'package.json'])).toBe(false);
  });

  it('returns false for empty changed files list', () => {
    expect(shouldRunDrift([])).toBe(false);
  });

  it('returns false for unrelated markdown files', () => {
    expect(shouldRunDrift(['docs/api.md', 'CHANGELOG.md'])).toBe(false);
  });

  it('returns false for unrelated config files', () => {
    expect(shouldRunDrift(['tsconfig.json', 'vitest.config.ts'])).toBe(false);
  });

  it('returns true when instruction file matches explicit path', () => {
    expect(
      shouldRunDrift(['src/index.ts', 'custom-instructions.md'], {
        instructionFile: 'custom-instructions.md',
      }),
    ).toBe(true);
  });

  it('returns true when eslint file matches explicit path', () => {
    expect(
      shouldRunDrift(['src/index.ts', 'custom-eslint.json'], {
        eslintFile: 'custom-eslint.json',
      }),
    ).toBe(true);
  });

  it('does not double-count a file that matches both patterns', () => {
    const result = shouldRunDrift(['CLAUDE.md']);
    expect(result).toBe(true);
  });
});

describe('autoDetectEslintFile', () => {
  it('detects .eslintrc.json', () => {
    expect(autoDetectEslintFile(['package.json', '.eslintrc.json', 'src/index.ts'])).toBe('.eslintrc.json');
  });

  it('detects eslint.config.js', () => {
    expect(autoDetectEslintFile(['eslint.config.js', 'src/index.ts'])).toBe('eslint.config.js');
  });

  it('detects eslint.config.mjs', () => {
    expect(autoDetectEslintFile(['eslint.config.mjs'])).toBe('eslint.config.mjs');
  });

  it('detects eslint.config.ts', () => {
    expect(autoDetectEslintFile(['eslint.config.ts'])).toBe('eslint.config.ts');
  });

  it('detects .eslintrc.js', () => {
    expect(autoDetectEslintFile(['.eslintrc.js'])).toBe('.eslintrc.js');
  });

  it('detects .eslintrc.cjs', () => {
    expect(autoDetectEslintFile(['.eslintrc.cjs'])).toBe('.eslintrc.cjs');
  });

  it('prefers eslint.config.js over .eslintrc.json', () => {
    expect(autoDetectEslintFile(['.eslintrc.json', 'eslint.config.js'])).toBe('eslint.config.js');
  });

  it('prefers eslint.config.mjs over .eslintrc.json', () => {
    expect(autoDetectEslintFile(['.eslintrc.json', 'eslint.config.mjs'])).toBe('eslint.config.mjs');
  });

  it('returns undefined when no eslint config is found', () => {
    expect(autoDetectEslintFile(['package.json', 'tsconfig.json', 'src/index.ts'])).toBeUndefined();
  });

  it('returns undefined for empty file list', () => {
    expect(autoDetectEslintFile([])).toBeUndefined();
  });

  it('ignores eslint config in subdirectories', () => {
    expect(autoDetectEslintFile(['packages/app/.eslintrc.json', 'src/index.ts'])).toBeUndefined();
  });

  it('detects .eslintrc.yml', () => {
    expect(autoDetectEslintFile(['.eslintrc.yml'])).toBe('.eslintrc.yml');
  });

  it('detects .eslintrc (no extension)', () => {
    expect(autoDetectEslintFile(['.eslintrc'])).toBe('.eslintrc');
  });
});