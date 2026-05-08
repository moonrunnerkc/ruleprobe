/**
 * Tests for ESLint config file parsing.
 *
 * Validates that parseEslintConfig correctly reads .eslintrc.json
 * files and extracts rule entries with severity and options.
 */

import { describe, it, expect } from 'vitest';
import { parseEslintConfig } from '../../src/drift/parseEslintConfig.js';
import { join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';

const fixturesDir = join(import.meta.dirname, 'fixtures');

describe('parseEslintConfig', () => {
  it('parses a basic .eslintrc.json with severity-only rules', () => {
    const result = parseEslintConfig(
      join(fixturesDir, 'eslintrc-basic.json'),
    );
    expect(result.sourceFile).toContain('eslintrc-basic.json');
    expect(result.rules).toHaveLength(4);

    const consoleRule = result.rules.find((r) => r.ruleName === 'no-console');
    expect(consoleRule).toBeDefined();
    expect(consoleRule!.severity).toBe('error');
    expect(consoleRule!.options).toEqual([]);

    const constRule = result.rules.find((r) => r.ruleName === 'prefer-const');
    expect(constRule).toBeDefined();
    expect(constRule!.severity).toBe('warn');
    expect(constRule!.options).toEqual([]);

    const maxLines = result.rules.find((r) => r.ruleName === 'max-lines');
    expect(maxLines).toBeDefined();
    expect(maxLines!.severity).toBe('error');
    expect(maxLines!.options).toEqual([{ max: 300 }]);

    const noAny = result.rules.find((r) => r.ruleName === '@typescript-eslint/no-explicit-any');
    expect(noAny).toBeDefined();
    expect(noAny!.severity).toBe('error');
    expect(noAny!.options).toEqual([]);
  });

  it('parses a config with off (disabled) rules', () => {
    const result = parseEslintConfig(
      join(fixturesDir, 'eslintrc-disabled.json'),
    );
    expect(result.rules).toHaveLength(2);

    const consoleRule = result.rules.find((r) => r.ruleName === 'no-console');
    expect(consoleRule!.severity).toBe('off');

    const constRule = result.rules.find((r) => r.ruleName === 'prefer-const');
    expect(constRule!.severity).toBe('warn');
  });

  it('parses a config with plugin rules and extended options', () => {
    const result = parseEslintConfig(
      join(fixturesDir, 'eslintrc-extended.json'),
    );
    expect(result.rules).toHaveLength(4);

    const namingRule = result.rules.find(
      (r) => r.ruleName === '@typescript-eslint/naming-convention',
    );
    expect(namingRule).toBeDefined();
    expect(namingRule!.severity).toBe('error');
    expect(namingRule!.options).toEqual([{ selector: 'variable', format: ['camelCase'] }]);

    const sonarRule = result.rules.find(
      (r) => r.ruleName === 'sonarjs/no-identical-conditions',
    );
    expect(sonarRule).toBeDefined();
    expect(sonarRule!.severity).toBe('error');
  });

  it('parses an empty rules config', () => {
    const result = parseEslintConfig(
      join(fixturesDir, 'eslintrc-empty.json'),
    );
    expect(result.rules).toHaveLength(0);
  });

  it('throws on a nonexistent file', () => {
    expect(() =>
      parseEslintConfig(join(fixturesDir, 'nonexistent.json')),
    ).toThrow();
  });

  it('throws on an unparseable JSON file', () => {
    const invalidPath = join(fixturesDir, 'eslintrc-invalid.json');
    writeFileSync(invalidPath, '{ invalid json !!!');
    try {
      expect(() => parseEslintConfig(invalidPath)).toThrow();
    } finally {
      unlinkSync(invalidPath);
    }
  });

  it('handles numeric severity values (0, 1, 2)', () => {
    const numericPath = join(fixturesDir, 'eslintrc-numeric.json');
    writeFileSync(numericPath, JSON.stringify({
      rules: {
        'no-console': 2,
        'prefer-const': 1,
        'no-var': 0,
      },
    }));
    try {
      const result = parseEslintConfig(numericPath);
      const consoleRule = result.rules.find((r) => r.ruleName === 'no-console');
      expect(consoleRule!.severity).toBe('error');
      const constRule = result.rules.find((r) => r.ruleName === 'prefer-const');
      expect(constRule!.severity).toBe('warn');
      const varRule = result.rules.find((r) => r.ruleName === 'no-var');
      expect(varRule!.severity).toBe('off');
    } finally {
      unlinkSync(numericPath);
    }
  });

  it('parses rules with arrays where severity is the first element', () => {
    const arrayPath = join(fixturesDir, 'eslintrc-array-severity.json');
    writeFileSync(arrayPath, JSON.stringify({
      rules: {
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    }));
    try {
      const result = parseEslintConfig(arrayPath);
      const consoleRule = result.rules.find((r) => r.ruleName === 'no-console');
      expect(consoleRule!.severity).toBe('warn');
      expect(consoleRule!.options).toEqual([{ allow: ['warn', 'error'] }]);
    } finally {
      unlinkSync(arrayPath);
    }
  });

  it('parses a flat config JSON array', () => {
    const flatPath = join(fixturesDir, 'eslint-config-flat.json');
    writeFileSync(flatPath, JSON.stringify([
      { rules: { 'no-console': 'error' } },
      { rules: { 'prefer-const': 'warn' } },
    ]));
    try {
      const result = parseEslintConfig(flatPath);
      expect(result.rules).toHaveLength(2);
      const consoleRule = result.rules.find((r) => r.ruleName === 'no-console');
      expect(consoleRule!.severity).toBe('error');
      const constRule = result.rules.find((r) => r.ruleName === 'prefer-const');
      expect(constRule!.severity).toBe('warn');
    } finally {
      unlinkSync(flatPath);
    }
  });
});