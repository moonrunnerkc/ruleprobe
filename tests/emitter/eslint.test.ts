/**
 * Tests for the ESLint config emitter.
 *
 * Validates that EslintConfig objects are correctly serialized to
 * both flat and legacy ESLint config formats, and that unmappable
 * rules appear as commented sections with reasons.
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

    it('emits rules with severity and options', () => {
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
      expect(output).toContain('@typescript-eslint/no-explicit-any');
      expect(output).toContain('prefer-const');
      expect(output).toContain('error');
      expect(output).toContain('warn');
      expect(output).toContain('destructuring');
    });

    it('emits plugin imports for flat config', () => {
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
  });

  describe('legacy config format', () => {
    it('emits a valid .eslintrc with no rules', () => {
      const config = makeConfig();
      const output = emitEslintConfig(config, 'legacy');
      expect(output).toContain('"rules"');
      expect(output).toContain('{');
      expect(output).toContain('}');
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
      expect(output).toContain('"@typescript-eslint/no-explicit-any"');
      expect(output).toContain('"error"');
      expect(output).toContain('"plugins"');
    });

    it('emits unmappable rules as comments in legacy format', () => {
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
      expect(output).toContain('// [strict-mode-1]');
      expect(output).toContain('TypeScript strict mode is a tsconfig setting');
    });
  });
});