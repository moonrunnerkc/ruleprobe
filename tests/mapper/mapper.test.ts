/**
 * Tests for the RuleProbe-to-ESLint mapper.
 *
 * Validates that parsed RuleProbe rules map correctly to ESLint
 * rule configurations, and that unmappable rules produce the
 * expected commented output.
 */

import { describe, it, expect } from 'vitest';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import type { RuleSet, Rule } from '../../src/types.js';

/** Build a minimal RuleSet with the given rules. */
function makeRuleSet(rules: Rule[]): RuleSet {
  return {
    sourceFile: 'test.md',
    sourceType: 'claude.md',
    rules,
    unparseable: [],
  };
}

/** Build a minimal Rule with sensible defaults. */
function makeRule(overrides: Partial<Rule> & { id: string; pattern: Rule['pattern'] }): Rule {
  return {
    category: 'forbidden-pattern',
    source: 'test instruction',
    description: 'test rule',
    severity: 'error',
    verifier: 'ast',
    confidence: 'high',
    extractionMethod: 'static',
    ...overrides,
  };
}

describe('mapRuleSetToEslintConfig', () => {
  it('maps no-any to @typescript-eslint/no-explicit-any', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-any-type-1',
        pattern: { type: 'no-any', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/no-explicit-any');
    expect(config.rules[0].severity).toBe('error');
    expect(config.rules[0].plugin).toBe('@typescript-eslint');
  });

  it('maps no-console-log to no-console', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-console-log-1',
        pattern: { type: 'no-console-log', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-console');
    expect(config.rules[0].severity).toBe('error');
  });

  it('maps no-console-extended to no-console (all methods banned)', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-console-extended-1',
        pattern: { type: 'no-console-extended', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-console');
    // no-console-extended bans all console methods, so no allow list
    expect(config.rules[0].options).toBeUndefined();
  });

  it('maps named-exports-only to import/no-default-export', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'structure-named-exports-only-1',
        category: 'structure',
        pattern: { type: 'named-exports-only', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('import/no-default-export');
    expect(config.rules[0].plugin).toBe('import');
  });

  it('maps kebab-case filenames to unicorn/filename-case', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'naming-kebab-case-files-1',
        category: 'naming',
        pattern: { type: 'kebab-case', target: 'filenames', expected: 'kebab-case', scope: 'project' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('unicorn/filename-case');
    expect(config.rules[0].plugin).toBe('unicorn');
  });

  it('maps max-file-length to max-lines with numeric option', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'structure-max-file-length-1',
        category: 'structure',
        severity: 'warning',
        pattern: { type: 'max-file-length', target: '*.ts', expected: '300', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('max-lines');
    expect(config.rules[0].options).toEqual([{ max: 300, skipBlankLines: true, skipComments: true }]);
    expect(config.rules[0].severity).toBe('warn');
  });

  it('maps max-line-length to max-len with numeric option', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'structure-max-line-length-1',
        category: 'forbidden-pattern',
        severity: 'warning',
        pattern: { type: 'max-line-length', target: '*.ts', expected: '120', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('max-len');
    expect(config.rules[0].options).toEqual([{ code: 120 }]);
  });

  it('maps jsdoc-required to jsdoc/require-jsdoc', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'structure-jsdoc-required-1',
        category: 'structure',
        severity: 'warning',
        pattern: { type: 'jsdoc-required', target: '*.ts', expected: true, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('jsdoc/require-jsdoc');
    expect(config.rules[0].plugin).toBe('jsdoc');
  });

  it('merges pascalcase-types and camelcase-variables into naming-convention', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'naming-pascalcase-types-1',
        category: 'naming',
        pattern: { type: 'PascalCase', target: 'types', expected: 'PascalCase', scope: 'file' },
      }),
      makeRule({
        id: 'naming-camelcase-variables-1',
        category: 'naming',
        pattern: { type: 'camelCase', target: 'variables', expected: 'camelCase', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    const namingRules = config.rules.filter(
      (r) => r.ruleName === '@typescript-eslint/naming-convention',
    );
    // Both rules should merge into a single naming-convention entry
    expect(namingRules).toHaveLength(1);
    expect(namingRules[0].plugin).toBe('@typescript-eslint');
  });

  it('maps no-var to no-var', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-var-1',
        pattern: { type: 'no-var', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-var');
  });

  it('maps prefer-const to prefer-const', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-prefer-const-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'prefer-const', target: '*.ts', expected: 'const', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('prefer-const');
  });

  it('maps no-empty-catch to no-empty', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'error-no-empty-catch-1',
        category: 'error-handling',
        pattern: { type: 'no-empty-catch', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-empty');
  });

  it('maps no-enum to @typescript-eslint/no-enum', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'type-no-enum-1',
        category: 'type-safety',
        severity: 'warning',
        pattern: { type: 'no-enum', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/no-enum');
  });

  it('maps no-type-assertions to @typescript-eslint/consistent-type-assertions', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'type-no-assertions-1',
        category: 'type-safety',
        severity: 'warning',
        pattern: { type: 'no-type-assertions', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/consistent-type-assertions');
  });

  it('maps no-non-null-assertions to @typescript-eslint/no-non-null-assertion', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'type-no-non-null-assertions-1',
        category: 'type-safety',
        severity: 'warning',
        pattern: { type: 'no-non-null-assertions', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/no-non-null-assertion');
  });

  it('maps no-nested-ternary to no-nested-ternary', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-no-nested-ternary-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'no-nested-ternary', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-nested-ternary');
  });

  it('maps no-magic-numbers to no-magic-numbers', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-no-magic-numbers-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'no-magic-numbers', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-magic-numbers');
  });

  it('maps max-function-length to max-lines-per-function', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-max-function-length-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'max-function-length', target: '*.ts', expected: '50', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('max-lines-per-function');
    expect(config.rules[0].options).toEqual([{ max: 50, skipBlankLines: true, skipComments: true }]);
  });

  it('maps max-params to max-params', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-max-params-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'max-params', target: '*.ts', expected: '4', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('max-params');
  });

  it('maps throw-error-only to no-throw-literal', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'error-throw-types-1',
        category: 'error-handling',
        pattern: { type: 'throw-error-only', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-throw-literal');
  });

  it('maps no-else-after-return to no-else-after-return', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-no-else-after-return-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'no-else-after-return', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-else-after-return');
  });

  it('maps no-wildcard-exports to no-restricted-syntax with ExportAllDeclaration selector', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'import-no-wildcard-exports-1',
        category: 'import-pattern',
        severity: 'warning',
        pattern: { type: 'no-wildcard-exports', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-restricted-syntax');
    expect(config.rules[0].plugin).toBeUndefined();
    const opts = (config.rules[0].options ?? [])[0] as { selector?: string };
    expect(opts.selector).toBe('ExportAllDeclaration');
  });

  it('maps no-namespace-imports to import/no-namespace', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'import-no-namespace-1',
        category: 'import-pattern',
        severity: 'warning',
        pattern: { type: 'no-namespace-imports', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('import/no-namespace');
  });

  it('maps no-ts-directives to @typescript-eslint/ban-ts-comment', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'type-no-ts-directives-1',
        category: 'type-safety',
        pattern: { type: 'no-ts-directives', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/ban-ts-comment');
  });

  it('maps consistent-semicolons to semi', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-consistent-semicolons-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'consistent-semicolons', target: '*.ts', expected: 'never', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('semi');
    expect(config.rules[0].options).toEqual(['never']);
  });

  it('maps quote-style to quotes', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-quote-style-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'quote-style', target: '*.ts', expected: 'single', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('quotes');
    expect(config.rules[0].options).toEqual(['error', 'single', { avoidEscape: true }]);
  });

  it('maps no-todo-comments to no-warning-comments', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-todo-comments-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'no-todo-comments', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('no-warning-comments');
    expect(config.rules[0].options).toEqual([{ terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'start' }]);
  });

  it('maps no-implicit-any to @typescript-eslint/no-explicit-any (closest ESLint rule)', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'type-no-implicit-any-1',
        category: 'type-safety',
        severity: 'warning',
        pattern: { type: 'no-implicit-any', target: '*.ts', expected: false, scope: 'project' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('@typescript-eslint/no-explicit-any');
  });

  it('maps no-unused-exports to import/no-unused-modules', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'structure-no-unused-exports-1',
        category: 'structure',
        severity: 'warning',
        pattern: { type: 'no-unused-exports', target: '*.ts', expected: false, scope: 'project' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].ruleName).toBe('import/no-unused-modules');
  });

  it('maps UPPER_CASE constants to naming-convention', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'naming-upper-case-constants-1',
        category: 'naming',
        severity: 'warning',
        pattern: { type: 'UPPER_CASE', target: 'constants', expected: 'UPPER_CASE', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    const naming = config.rules.filter(
      (r) => r.ruleName === '@typescript-eslint/naming-convention',
    );
    expect(naming).toHaveLength(1);
  });

  it('collects unmappable rules with reasons', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'test-files-exist-1',
        category: 'test-requirement',
        pattern: { type: 'test-files-exist', target: 'src/**/*.ts', expected: true, scope: 'project' },
        source: 'Every source file must have a corresponding test file',
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules).toHaveLength(0);
    expect(config.unmappable).toHaveLength(1);
    expect(config.unmappable[0].sourceRuleId).toBe('test-files-exist-1');
    expect(config.unmappable[0].reason).toBeTruthy();
  });

  it('deduplicates plugins list', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-any-type-1',
        pattern: { type: 'no-any', target: '*.ts', expected: false, scope: 'file' },
      }),
      makeRule({
        id: 'type-no-enum-1',
        category: 'type-safety',
        pattern: { type: 'no-enum', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    const tsPluginCount = config.plugins.filter((p) => p === '@typescript-eslint').length;
    expect(tsPluginCount).toBe(1);
  });

  it('maps RuleProbe warning severity to ESLint warn', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'style-prefer-const-1',
        category: 'code-style',
        severity: 'warning',
        pattern: { type: 'prefer-const', target: '*.ts', expected: 'const', scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules[0].severity).toBe('warn');
  });

  it('maps RuleProbe error severity to ESLint error', () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: 'forbidden-no-any-type-1',
        pattern: { type: 'no-any', target: '*.ts', expected: false, scope: 'file' },
      }),
    ]);
    const config = mapRuleSetToEslintConfig(ruleSet);
    expect(config.rules[0].severity).toBe('error');
  });
});