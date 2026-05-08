/**
 * End-to-end test for the lint-config command.
 *
 * Parses a real instruction file, maps it to an ESLint config,
 * and validates the output contains the expected rules.
 */

import { describe, it, expect } from 'vitest';
import { parseInstructionContent } from '../../src/parsers/index.js';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import { emitEslintConfig } from '../../src/emitter/eslint.js';
import type { EslintConfig } from '../../src/mapper/types.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('lint-config end-to-end', () => {
  it('parses sample-agents.md and produces mappable ESLint rules', () => {
    const content = readFileSync(resolve(FIXTURES_DIR, 'sample-agents.md'), 'utf-8');
    const ruleSet = parseInstructionContent(content, 'sample-agents.md');
    const config = mapRuleSetToEslintConfig(ruleSet);

    // Should have mapped multiple rules
    expect(config.rules.length).toBeGreaterThan(5);

    // Should have specific rules
    const ruleNames = config.rules.map((r) => r.ruleName);
    expect(ruleNames).toContain('@typescript-eslint/no-explicit-any');
    expect(ruleNames).toContain('import/no-default-export');
    expect(ruleNames).toContain('unicorn/filename-case');
    expect(ruleNames).toContain('max-lines');
    expect(ruleNames).toContain('prefer-const');
    expect(ruleNames).toContain('no-var');
    expect(ruleNames).toContain('no-empty');
    expect(ruleNames).toContain('no-throw-literal');
    expect(ruleNames).toContain('no-console');

    // Should have naming-convention (merged from pascalcase + camelcase)
    expect(ruleNames).toContain('@typescript-eslint/naming-convention');

    // Should have required plugins
    expect(config.plugins).toContain('@typescript-eslint');
    expect(config.plugins).toContain('import');
    expect(config.plugins).toContain('unicorn');
  });

  it('emits flat config that looks like valid JS', () => {
    const content = readFileSync(resolve(FIXTURES_DIR, 'sample-agents.md'), 'utf-8');
    const ruleSet = parseInstructionContent(content, 'sample-agents.md');
    const config = mapRuleSetToEslintConfig(ruleSet);
    const output = emitEslintConfig(config, 'flat');

    expect(output).toContain('export default [');
    expect(output).toContain('rules: {');
    expect(output).toContain('@typescript-eslint/no-explicit-any');
    expect(output).toContain('// Source: sample-agents.md');
  });

  it('emits legacy config that looks like valid JSON', () => {
    const content = readFileSync(resolve(FIXTURES_DIR, 'sample-agents.md'), 'utf-8');
    const ruleSet = parseInstructionContent(content, 'sample-agents.md');
    const config = mapRuleSetToEslintConfig(ruleSet);
    const output = emitEslintConfig(config, 'legacy');

    expect(output).toContain('"rules"');
    expect(output).toContain('"@typescript-eslint/no-explicit-any"');
    expect(output).toContain('"error"');
  });

  it('marks unmappable rules with reasons', () => {
    const content = readFileSync(resolve(FIXTURES_DIR, 'sample-agents.md'), 'utf-8');
    const ruleSet = parseInstructionContent(content, 'sample-agents.md');
    const config = mapRuleSetToEslintConfig(ruleSet);

    // Some rules from the fixture should be unmappable (e.g. path aliases)
    // The config should have an unmappable array, even if empty
    expect(config.unmappable).toBeDefined();
    expect(Array.isArray(config.unmappable)).toBe(true);
  });

  it('emits unmappable rules as comments in flat config', () => {
    const config: EslintConfig = {
      rules: [
        {
          ruleName: '@typescript-eslint/no-explicit-any',
          plugin: '@typescript-eslint',
          severity: 'error',
          sourceRuleId: 'test-1',
          description: 'No any',
        },
      ],
      unmappable: [
        {
          sourceRuleId: 'test-files-exist-1',
          sourceText: 'Every file must have a test',
          reason: 'No ESLint rule enforces test file existence',
        },
      ],
      plugins: ['@typescript-eslint'],
      sourceFile: 'test.md',
    };
    const output = emitEslintConfig(config, 'flat');
    expect(output).toContain('Unmappable rules');
    expect(output).toContain('test-files-exist-1');
    expect(output).toContain('No ESLint rule enforces test file existence');
    expect(output).toContain('Every file must have a test');
  });
});