/**
 * Tests for the ESLint config to CLAUDE.md rules extractor.
 *
 * Validates that extractRules correctly reverse-maps ESLint config
 * entries to prose instructions, skips stylistic rules, handles
 * unknown rules, and formats markdown output.
 */

import { describe, it, expect } from 'vitest';
import { parseEslintConfig } from '../../src/drift/parse-eslint-config.js';
import { extractRules, formatRulesMarkdown } from '../../src/extractor/index.js';
import type { ParsedEslintConfig } from '../../src/drift/types.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, 'fixtures');

describe('extractRules', () => {
  it('extracts prose for basic mappable rules', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-basic.json'));
    const result = extractRules(config);

    expect(result.rules.length).toBeGreaterThan(0);

    const noAny = result.rules.find((r) => r.eslintRuleName === '@typescript-eslint/no-explicit-any');
    expect(noAny).toBeDefined();
    expect(noAny!.prose).toContain('`any`');
    expect(noAny!.patternType).toBe('no-any');

    const noConsole = result.rules.find((r) => r.eslintRuleName === 'no-console');
    expect(noConsole).toBeDefined();
    expect(noConsole!.prose).toContain('console');

    const noVar = result.rules.find((r) => r.eslintRuleName === 'no-var');
    expect(noVar).toBeDefined();
    expect(noVar!.prose).toContain('`var`');
  });

  it('skips stylistic rules with no prose equivalent', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-stylistic.json'));
    const result = extractRules(config);

    const stylisticRules = result.skipped.filter((s) => s.reason === 'stylistic');
    expect(stylisticRules.length).toBeGreaterThanOrEqual(2);

    const semiSkip = result.skipped.find((s) => s.eslintRuleName === 'semi');
    expect(semiSkip).toBeDefined();
    expect(semiSkip!.reason).toBe('stylistic');

    const quotesSkip = result.skipped.find((s) => s.eslintRuleName === 'quotes');
    expect(quotesSkip).toBeDefined();
    expect(quotesSkip!.reason).toBe('stylistic');

    // Non-stylistic rules should still be extracted
    const noVar = result.rules.find((r) => r.eslintRuleName === 'no-var');
    expect(noVar).toBeDefined();
  });

  it('handles naming convention rules with complex options', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-naming.json'));
    const result = extractRules(config);

    const namingRules = result.rules.filter((r) => r.eslintRuleName === '@typescript-eslint/naming-convention');
    expect(namingRules.length).toBeGreaterThanOrEqual(2);

    const pascalRule = namingRules.find((r) => r.prose.includes('PascalCase'));
    expect(pascalRule).toBeDefined();

    const camelRule = namingRules.find((r) => r.prose.includes('camelCase'));
    expect(camelRule).toBeDefined();

    // Each selector should produce distinct prose
    const proseValues = namingRules.map((r) => r.prose);
    const uniqueProse = new Set(proseValues);
    expect(uniqueProse.size).toBe(proseValues.length);
  });

  it('skips unknown rules with no mapping', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-unknown.json'));
    const result = extractRules(config);

    const unknownSkips = result.skipped.filter((s) => s.reason === 'no-mapping');
    expect(unknownSkips.length).toBe(2);

    const unknown1 = result.skipped.find((s) => s.eslintRuleName === 'some-plugin/unknown-rule');
    expect(unknown1).toBeDefined();
    expect(unknown1!.reason).toBe('no-mapping');

    // Known rules should still be extracted
    const noConsole = result.rules.find((r) => r.eslintRuleName === 'no-console');
    expect(noConsole).toBeDefined();
  });

  it('skips disabled (off) rules', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-off.json'));
    const result = extractRules(config);

    // no-console is "off" and should not appear in extracted rules
    const noConsole = result.rules.find((r) => r.eslintRuleName === 'no-console');
    expect(noConsole).toBeUndefined();

    // no-var should still be extracted
    const noVar = result.rules.find((r) => r.eslintRuleName === 'no-var');
    expect(noVar).toBeDefined();
  });

  it('extracts prose with interpolated config args', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-with-args.json'));
    const result = extractRules(config);

    const maxLines = result.rules.find((r) => r.eslintRuleName === 'max-lines');
    expect(maxLines).toBeDefined();
    expect(maxLines!.prose).toContain('300');

    const maxLen = result.rules.find((r) => r.eslintRuleName === 'max-len');
    expect(maxLen).toBeDefined();
    expect(maxLen!.prose).toContain('120');

    const maxParams = result.rules.find((r) => r.eslintRuleName === 'max-params');
    expect(maxParams).toBeDefined();
    expect(maxParams!.prose).toContain('4');

    const maxLinesPerFn = result.rules.find((r) => r.eslintRuleName === 'max-lines-per-function');
    expect(maxLinesPerFn).toBeDefined();
    expect(maxLinesPerFn!.prose).toContain('50');

    const todoComments = result.rules.find((r) => r.eslintRuleName === 'no-warning-comments');
    expect(todoComments).toBeDefined();
    expect(todoComments!.prose).toContain('todo');
    expect(todoComments!.prose).toContain('fixme');
  });

  it('returns the source file path', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-basic.json'));
    const result = extractRules(config);
    expect(result.sourceFile).toContain('eslintrc-basic.json');
  });
});

describe('formatRulesMarkdown', () => {
  it('formats extracted rules as markdown with heading and bullets', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-basic.json'));
    const result = extractRules(config);
    const markdown = formatRulesMarkdown(result);

    expect(markdown).toContain('## Rules');
    expect(markdown).toContain('- ');
    expect(markdown).toContain('`any`');
  });

  it('includes skipped rules in an HTML comment block', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-stylistic.json'));
    const result = extractRules(config);
    const markdown = formatRulesMarkdown(result);

    expect(markdown).toContain('<!-- Skipped rules');
    expect(markdown).toContain('semi');
    expect(markdown).toContain('stylistic');
    expect(markdown).toContain('-->');
  });

  it('does not include skipped block when no rules are skipped', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'no-var', severity: 'error', options: [] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const markdown = formatRulesMarkdown(result);

    expect(markdown).toContain('## Rules');
    expect(markdown).not.toContain('<!-- Skipped rules');
  });

  it('formats unknown rules in skipped block with no-mapping reason', () => {
    const config = parseEslintConfig(join(fixturesDir, 'eslintrc-unknown.json'));
    const result = extractRules(config);
    const markdown = formatRulesMarkdown(result);

    expect(markdown).toContain('<!-- Skipped rules');
    expect(markdown).toContain('some-plugin/unknown-rule');
    expect(markdown).toContain('no RuleProbe equivalent');
  });
});

describe('extractRules with direct config', () => {
  it('handles empty rules array', () => {
    const config: ParsedEslintConfig = {
      rules: [],
      sourceFile: 'empty.json',
    };
    const result = extractRules(config);
    expect(result.rules).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('handles no-console with allow list', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'no-console', severity: 'error', options: [{ allow: ['warn', 'error'] }] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'no-console');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('warn');
    expect(rule!.prose).toContain('error');
  });

  it('handles no-console without allow list', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'no-console', severity: 'error', options: [] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'no-console');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('console');
    expect(rule!.prose).not.toContain('except');
  });

  it('handles unicorn/filename-case with kebab option', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'unicorn/filename-case', severity: 'error', options: [{ cases: { kebab: true } }] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'unicorn/filename-case');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('kebab');
  });

  it('handles max-lines with default when no options', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'max-lines', severity: 'warn', options: [] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'max-lines');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('300');
  });

  it('handles no-empty with allowEmptyCatch false', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'no-empty', severity: 'error', options: [{ allowEmptyCatch: false }] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'no-empty');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('Catch');
  });

  it('handles no-warning-comments with terms', () => {
    const config: ParsedEslintConfig = {
      rules: [{ ruleName: 'no-warning-comments', severity: 'warn', options: [{ terms: ['TODO', 'FIXME'] }] }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const rule = result.rules.find((r) => r.eslintRuleName === 'no-warning-comments');
    expect(rule).toBeDefined();
    expect(rule!.prose).toContain('TODO');
    expect(rule!.prose).toContain('FIXME');
  });

  it('deduplicates naming convention selectors', () => {
    const config: ParsedEslintConfig = {
      rules: [{
        ruleName: '@typescript-eslint/naming-convention',
        severity: 'error',
        options: [{
          rules: [
            { selector: 'class', format: ['PascalCase'] },
            { selector: 'interface', format: ['PascalCase'] },
          ],
        }],
      }],
      sourceFile: 'test.json',
    };
    const result = extractRules(config);
    const namingRules = result.rules.filter((r) => r.eslintRuleName === '@typescript-eslint/naming-convention');
    // PascalCase should appear once for classes, once for interfaces
    expect(namingRules.length).toBe(2);
    // Both should mention PascalCase
    expect(namingRules.every((r) => r.prose.includes('PascalCase'))).toBe(true);
  });
});