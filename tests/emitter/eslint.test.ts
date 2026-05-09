/**
 * Tests for the ESLint config emitter.
 *
 * Validates that EslintConfig objects are correctly serialized to
 * both flat and legacy ESLint config formats, that generated configs
 * parse and validate correctly, and that unmappable rules appear
 * as commented sections with reasons.
 */

import { describe, it, expect } from 'vitest';
import { emitEslintConfig } from '../../src/emitter/eslint.js';
import type { EslintConfig } from '../../src/mapper/types.js';

function makeConfig(overrides: Partial<EslintConfig> = {}): EslintConfig {
  return {
    rules: [],
    unmappable: [],
    plugins: [],
    sourceFile: 'CLAUDE.md',
    ...overrides,
  };
}

describe('emitEslintConfig', () => {
  describe('flat config format', () => {
    it('emits a valid flat config with no rules', () => {
      const config = makeConfig();
      const output = emitEslintConfig(config, 'flat');
      expect(output).toContain('export default [');
      expect(output).toContain('rules: {');
      expect(output).toContain('Source: CLAUDE.md');
    });

    it('emits rules as object properties with string severity values', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'forbidden-no-any-type-1',
            description: 'The "any" type must not be used',
          },
          {
            ruleName: 'prefer-const',
            severity: 'warn',
            options: [{ destructuring: 'all' }],
            sourceRuleId: 'style-prefer-const-1',
            description: 'Prefer const',
          },
        ],
        plugins: ['@typescript-eslint'],
      });
      const output = emitEslintConfig(config, 'flat');

      // Rules must be object properties with quoted keys, not array entries
      expect(output).toContain("'@typescript-eslint/no-explicit-any': [");
      expect(output).toContain("'prefer-const': [");

      // Severity must be a string value, not a bare identifier
      expect(output).toContain("'error'");
      expect(output).toContain("'warn'");

      // Options must be present
      expect(output).toContain('destructuring');
    });

    it('emits plugin imports and plugin object for flat config', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'test-1',
            description: 'test',
          },
        ],
        plugins: ['@typescript-eslint'],
      });
      const output = emitEslintConfig(config, 'flat');
      expect(output).toContain('@typescript-eslint/eslint-plugin');
      expect(output).toContain('plugins: {');
      expect(output).toContain("'@typescript-eslint': _typescript_eslintPlugin");
    });

    it('emits unmappable rules as commented sections', () => {
      const config = makeConfig({
        unmappable: [
          {
            sourceRuleId: 'test-files-exist-1',
            sourceText: 'Every source file must have a corresponding test file',
            reason: 'No ESLint rule enforces test file existence',
          },
        ],
      });
      const output = emitEslintConfig(config, 'flat');
      expect(output).toContain('Unmappable rules');
      expect(output).toContain('test-files-exist-1');
      expect(output).toContain('No ESLint rule enforces test file existence');
      expect(output).toContain('Every source file must have a corresponding test file');
    });

    it('emits numeric options correctly', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: 'max-lines',
            severity: 'warn',
            options: [{ max: 300, skipBlankLines: true, skipComments: true }],
            sourceRuleId: 'structure-max-file-length-1',
            description: 'Max file length',
          },
        ],
      });
      const output = emitEslintConfig(config, 'flat');
      expect(output).toContain('300');
      expect(output).toContain('skipBlankLines');
    });

    it('produces syntactically valid flat config JavaScript', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'test-1',
            description: 'No any',
          },
          {
            ruleName: 'no-console',
            severity: 'warn',
            sourceRuleId: 'test-2',
            description: 'No console',
          },
        ],
        plugins: ['@typescript-eslint'],
      });
      const output = emitEslintConfig(config, 'flat');

      // The output must be parseable as ES module JS
      // Check for required structural elements
      expect(output).toMatch(/import\s+\w+Plugin\s+from\s+['"]/);
      expect(output).toContain('export default [');
      expect(output).toContain('plugins: {');
      expect(output).toContain('rules: {');

      // Rule entries must use object property syntax, not array syntax
      expect(output).toContain("'@typescript-eslint/no-explicit-any': [");
      expect(output).toContain("'no-console': [");

      // Severity must be a quoted string, not a bare identifier
      expect(output).toContain("'error'");
      expect(output).toContain("'warn'");
    });

    it('handles multiple plugins in flat config', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'test-1',
            description: 'test',
          },
          {
            ruleName: 'import/no-namespace',
            plugin: 'import',
            severity: 'warn',
            sourceRuleId: 'test-2',
            description: 'test',
          },
        ],
        plugins: ['@typescript-eslint', 'import'],
      });
      const output = emitEslintConfig(config, 'flat');
      expect(output).toContain('@typescript-eslint/eslint-plugin');
      expect(output).toContain('eslint-plugin-import');
      expect(output).toContain('_typescript_eslintPlugin');
      expect(output).toContain('importPlugin');
    });
  });

  describe('legacy config format', () => {
    it('emits valid JSON for .eslintrc.json with no rules', () => {
      const config = makeConfig();
      const output = emitEslintConfig(config, 'legacy');
      // Must be valid JSON
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('rules');
      expect(parsed.rules).toEqual({});
    });

    it('emits rules with severity and options in legacy format', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'forbidden-no-any-type-1',
            description: 'No any type',
          },
        ],
        plugins: ['@typescript-eslint'],
      });
      const output = emitEslintConfig(config, 'legacy');
      const parsed = JSON.parse(output);
      expect(parsed.rules['@typescript-eslint/no-explicit-any']).toBe('error');
      expect(parsed.plugins).toEqual(['@typescript-eslint']);
      expect(parsed.extends).toEqual([
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ]);
    });

    it('emits rules with options in legacy format', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: 'max-lines',
            severity: 'warn',
            options: [{ max: 300, skipBlankLines: true }],
            sourceRuleId: 'structure-max-file-length-1',
            description: 'Max file length',
          },
        ],
      });
      const output = emitEslintConfig(config, 'legacy');
      const parsed = JSON.parse(output);
      expect(parsed.rules['max-lines']).toEqual(['warn', { max: 300, skipBlankLines: true }]);
    });

    it('produces valid JSON that can be parsed by JSON.parse', () => {
      const config = makeConfig({
        rules: [
          {
            ruleName: '@typescript-eslint/no-explicit-any',
            plugin: '@typescript-eslint',
            severity: 'error',
            sourceRuleId: 'test-1',
            description: 'No any',
          },
          {
            ruleName: 'no-console',
            severity: 'warn',
            sourceRuleId: 'test-2',
            description: 'No console',
          },
          {
            ruleName: 'prefer-const',
            severity: 'warn',
            options: [{ destructuring: 'all' }],
            sourceRuleId: 'test-3',
            description: 'Prefer const',
          },
        ],
        plugins: ['@typescript-eslint'],
      });
      const output = emitEslintConfig(config, 'legacy');

      // Must be valid JSON - no trailing commas, no comments, no bare identifiers
      const parsed = JSON.parse(output);
      expect(Object.keys(parsed.rules)).toHaveLength(3);
      expect(parsed.rules['@typescript-eslint/no-explicit-any']).toBe('error');
      expect(parsed.rules['no-console']).toBe('warn');
      expect(parsed.rules['prefer-const']).toEqual(['warn', { destructuring: 'all' }]);
    });

    it('emits unmappable rules in a comment block after the JSON', () => {
      const config = makeConfig({
        unmappable: [
          {
            sourceRuleId: 'strict-mode-1',
            sourceText: 'Use TypeScript strict mode',
            reason: 'TypeScript strict mode is a tsconfig setting',
          },
        ],
      });
      const output = emitEslintConfig(config, 'legacy');

      // Find the JSON portion (ends before the unmappable comment block, or at end)
      const commentMarker = '// Unmappable rules';
      const commentStart = output.indexOf(commentMarker);
      const jsonPart = commentStart >= 0 ? output.substring(0, commentStart).trimEnd() : output;
      const parsed = JSON.parse(jsonPart);
      expect(parsed).toHaveProperty('rules');

      // The unmappable section must appear after the JSON
      expect(output).toContain('// [strict-mode-1]');
      expect(output).toContain('TypeScript strict mode is a tsconfig setting');
    });
  });
});