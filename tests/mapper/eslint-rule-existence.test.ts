/**
 * Validates that every ESLint rule name the mapper can emit actually
 * exists in the loaded plugin's rule registry.
 *
 * Until this test existed, mapper correctness was guaranteed only by
 * string-matching tests that did not load the real plugins. That left
 * room for typos, removed rules, and renames to ship undetected.
 *
 * The test is structured in two layers:
 *   1. Per-mapper assertion: each mapper function emits a known rule
 *      name, and that name is present in the corresponding plugin's
 *      `rules` registry.
 *   2. End-to-end smoke: build a config from a sample RuleSet, hand it
 *      to ESLint, and assert ESLint does not raise
 *      "Definition for rule X was not found" on a real source file.
 */

import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import unicornPlugin from 'eslint-plugin-unicorn';

import { mapNoAny } from '../../src/mapper/mappings/no-any.js';
import { mapNamedExports } from '../../src/mapper/mappings/named-exports.js';
import { mapKebabCaseFiles } from '../../src/mapper/mappings/kebab-case-files.js';
import { mapMaxFileLines, mapMaxLineLength } from '../../src/mapper/mappings/max-lines.js';
import { mapNoConsoleLog, mapNoConsoleExtended } from '../../src/mapper/mappings/no-console.js';
import { mapJsdocRequired } from '../../src/mapper/mappings/jsdoc-required.js';
import { buildNamingConventionRule, addNamingPattern, resetNamingAccumulator } from '../../src/mapper/mappings/naming-convention.js';
import {
  mapNoVar,
  mapPreferConst,
  mapNoElseAfterReturn,
  mapNoNestedTernary,
  mapNoMagicNumbers,
  mapConsistentSemicolons,
  mapQuoteStyle,
} from '../../src/mapper/mappings/code-style.js';
import { mapNoEmptyCatch, mapThrowErrorOnly } from '../../src/mapper/mappings/error-handling.js';
import {
  mapNoEnum,
  mapNoTypeAssertions,
  mapNonNullAssertions,
  mapNoImplicitAny,
  mapNoUnusedExports,
  mapNoTsDirectives,
} from '../../src/mapper/mappings/type-safety.js';
import { mapMaxFunctionLength, mapMaxParams } from '../../src/mapper/mappings/function-limits.js';
import {
  mapNoWildcardExports,
  mapNoNamespaceImports,
  mapNoPathAliases,
  mapNoDeepRelativeImports,
} from '../../src/mapper/mappings/imports.js';
import { mapNoTodoComments } from '../../src/mapper/mappings/no-todo.js';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import type { Rule, RuleSet } from '../../src/types.js';

/**
 * Names of every core ESLint rule the mapper can emit. Core rules
 * have no plugin prefix and are validated against the Linter's
 * built-in rule map.
 */
const CORE_RULES = [
  'max-len',
  'max-lines',
  'max-lines-per-function',
  'max-params',
  'no-console',
  'no-else-return',
  'no-empty',
  'no-magic-numbers',
  'no-nested-ternary',
  'no-restricted-imports',
  'no-restricted-syntax',
  'no-throw-literal',
  'no-var',
  'no-warning-comments',
  'prefer-const',
  'quotes',
  'semi',
] as const;

/**
 * Every mapper function and the rule name we expect it to emit.
 *
 * The mapper module is the source of truth for which rule each
 * pattern type translates to; this table is the contract the
 * external ESLint registries must honor for those choices.
 */
const MAPPER_RULES: Array<{ description: string; name: string; plugin?: string }> = [
  { description: 'mapNoAny', name: mapNoAny().ruleName, plugin: mapNoAny().plugin },
  { description: 'mapNamedExports', name: mapNamedExports().ruleName, plugin: mapNamedExports().plugin },
  { description: 'mapKebabCaseFiles', name: mapKebabCaseFiles().ruleName, plugin: mapKebabCaseFiles().plugin },
  { description: 'mapMaxFileLines', name: mapMaxFileLines('300').ruleName, plugin: mapMaxFileLines('300').plugin },
  { description: 'mapMaxLineLength', name: mapMaxLineLength('120').ruleName, plugin: mapMaxLineLength('120').plugin },
  { description: 'mapNoConsoleLog', name: mapNoConsoleLog().ruleName, plugin: mapNoConsoleLog().plugin },
  { description: 'mapNoConsoleExtended', name: mapNoConsoleExtended().ruleName, plugin: mapNoConsoleExtended().plugin },
  { description: 'mapJsdocRequired', name: mapJsdocRequired().ruleName, plugin: mapJsdocRequired().plugin },
  { description: 'mapNoVar', name: mapNoVar().ruleName, plugin: mapNoVar().plugin },
  { description: 'mapPreferConst', name: mapPreferConst().ruleName, plugin: mapPreferConst().plugin },
  { description: 'mapNoElseAfterReturn', name: mapNoElseAfterReturn().ruleName, plugin: mapNoElseAfterReturn().plugin },
  { description: 'mapNoNestedTernary', name: mapNoNestedTernary().ruleName, plugin: mapNoNestedTernary().plugin },
  { description: 'mapNoMagicNumbers', name: mapNoMagicNumbers().ruleName, plugin: mapNoMagicNumbers().plugin },
  { description: 'mapConsistentSemicolons', name: mapConsistentSemicolons('always').ruleName, plugin: mapConsistentSemicolons('always').plugin },
  { description: 'mapQuoteStyle', name: mapQuoteStyle('single').ruleName, plugin: mapQuoteStyle('single').plugin },
  { description: 'mapNoEmptyCatch', name: mapNoEmptyCatch().ruleName, plugin: mapNoEmptyCatch().plugin },
  { description: 'mapThrowErrorOnly', name: mapThrowErrorOnly().ruleName, plugin: mapThrowErrorOnly().plugin },
  { description: 'mapNoEnum', name: mapNoEnum().ruleName, plugin: mapNoEnum().plugin },
  { description: 'mapNoTypeAssertions', name: mapNoTypeAssertions().ruleName, plugin: mapNoTypeAssertions().plugin },
  { description: 'mapNonNullAssertions', name: mapNonNullAssertions().ruleName, plugin: mapNonNullAssertions().plugin },
  { description: 'mapNoImplicitAny', name: mapNoImplicitAny().ruleName, plugin: mapNoImplicitAny().plugin },
  { description: 'mapNoUnusedExports', name: mapNoUnusedExports().ruleName, plugin: mapNoUnusedExports().plugin },
  { description: 'mapNoTsDirectives', name: mapNoTsDirectives().ruleName, plugin: mapNoTsDirectives().plugin },
  { description: 'mapMaxFunctionLength', name: mapMaxFunctionLength('50').ruleName, plugin: mapMaxFunctionLength('50').plugin },
  { description: 'mapMaxParams', name: mapMaxParams('4').ruleName, plugin: mapMaxParams('4').plugin },
  { description: 'mapNoWildcardExports', name: mapNoWildcardExports().ruleName, plugin: mapNoWildcardExports().plugin },
  { description: 'mapNoNamespaceImports', name: mapNoNamespaceImports().ruleName, plugin: mapNoNamespaceImports().plugin },
  { description: 'mapNoPathAliases', name: mapNoPathAliases().ruleName, plugin: mapNoPathAliases().plugin },
  { description: 'mapNoDeepRelativeImports', name: mapNoDeepRelativeImports('2').ruleName, plugin: mapNoDeepRelativeImports('2').plugin },
  { description: 'mapNoTodoComments', name: mapNoTodoComments().ruleName, plugin: mapNoTodoComments().plugin },
  { description: 'buildNamingConventionRule', name: buildNamingConventionRuleForTest(), plugin: '@typescript-eslint' },
];

/**
 * Helper to invoke buildNamingConventionRule in isolation. It uses a
 * module-level accumulator that needs at least one pattern to produce
 * output, and the accumulator must be reset between calls.
 */
function buildNamingConventionRuleForTest(): string {
  resetNamingAccumulator();
  addNamingPattern('PascalCase', 'rule-id-pascal');
  return buildNamingConventionRule().ruleName;
}

/**
 * Lookup table from plugin name to its rules registry. Each plugin
 * exposes a `.rules` property whose keys are the un-prefixed rule
 * names. We strip the plugin prefix from the mapper's emitted name
 * before checking presence.
 */
const PLUGIN_RULES: Record<string, ReadonlySet<string>> = {
  '@typescript-eslint': new Set(Object.keys(tseslintPlugin.rules ?? {})),
  'import': new Set(Object.keys(importPlugin.rules ?? {})),
  'jsdoc': new Set(Object.keys(jsdocPlugin.rules ?? {})),
  'unicorn': new Set(Object.keys(unicornPlugin.rules ?? {})),
};

/** Set of core ESLint rule names supplied by the Linter. */
const LINTER_BUILTIN_RULES: ReadonlySet<string> = new Set(
  Array.from(new Linter({ configType: 'eslintrc' }).getRules().keys()),
);

describe('mapper rule names exist in their plugins', () => {
  it('every core rule the mapper can emit exists in the ESLint Linter', () => {
    for (const name of CORE_RULES) {
      expect(LINTER_BUILTIN_RULES.has(name), `core rule "${name}" not found in eslint`).toBe(true);
    }
  });

  for (const entry of MAPPER_RULES) {
    it(`${entry.description} emits a real rule (${entry.name})`, () => {
      const fullName = entry.name;
      if (!entry.plugin) {
        expect(LINTER_BUILTIN_RULES.has(fullName), `core rule "${fullName}" not found`).toBe(true);
        return;
      }

      const prefix = `${entry.plugin}/`;
      expect(fullName.startsWith(prefix), `rule "${fullName}" should start with "${prefix}"`).toBe(true);
      const bareName = fullName.slice(prefix.length);

      const registry = PLUGIN_RULES[entry.plugin];
      expect(registry, `no plugin registry loaded for "${entry.plugin}"`).toBeDefined();
      expect(
        registry?.has(bareName),
        `rule "${fullName}" not found in plugin "${entry.plugin}". ` +
        `Available rules with similar prefix: ${
          [...(registry ?? [])].filter((n) => n.startsWith(bareName.slice(0, 3))).slice(0, 5).join(', ')
        }`,
      ).toBe(true);
    });
  }
});

describe('end-to-end ESLint integration', () => {
  /** Build a synthetic RuleSet that exercises every mappable matcher. */
  function buildExhaustiveRuleSet(): RuleSet {
    const rules: Rule[] = [];
    let counter = 0;
    function add(partial: Partial<Rule> & Pick<Rule, 'pattern'>): void {
      counter++;
      rules.push({
        id: `e2e-rule-${counter}`,
        category: 'code-style',
        source: '',
        description: '',
        severity: 'warning',
        verifier: 'ast',
        ...partial,
      });
    }
    add({ pattern: { type: 'no-any', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'named-exports-only', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-console-log', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-console-extended', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-var', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'prefer-const', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-else-after-return', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-nested-ternary', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-magic-numbers', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-empty-catch', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'throw-error-only', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-enum', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-type-assertions', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-non-null-assertions', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-implicit-any', target: '*.ts', expected: true, scope: 'file' } });
    // no-unused-exports maps to import/no-unused-modules which has a known
    // flat-config infrastructural issue (it wants an .eslintrc to read
    // ignorePatterns). The mapper-level test already verifies the rule name
    // exists, so we omit it from the e2e Linter.verify path.
    add({ pattern: { type: 'no-ts-directives', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'max-function-length', target: '*.ts', expected: '50', scope: 'file' } });
    add({ pattern: { type: 'max-params', target: '*.ts', expected: '4', scope: 'file' } });
    add({ pattern: { type: 'max-file-length', target: '*.ts', expected: '300', scope: 'file' } });
    add({ pattern: { type: 'no-wildcard-exports', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-namespace-imports', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-path-aliases', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-deep-relative-imports', target: '*.ts', expected: '2', scope: 'file' } });
    add({ pattern: { type: 'jsdoc-required', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'kebab-case', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'no-todo-comments', target: '*.ts', expected: true, scope: 'file' } });
    add({ pattern: { type: 'PascalCase', target: 'types', expected: true, scope: 'file' } });
    add({ pattern: { type: 'camelCase', target: 'variables', expected: true, scope: 'file' } });
    return {
      sourceFile: 'synthetic.md',
      sourceType: 'claude.md',
      rules,
      unparseable: [],
    };
  }

  it('Linter.verify accepts the generated config without "rule not found" errors', () => {
    const ruleSet = buildExhaustiveRuleSet();
    const config = mapRuleSetToEslintConfig(ruleSet);

    const rulesObject: Record<string, unknown> = {};
    for (const entry of config.rules) {
      const value = entry.options && entry.options.length > 0
        ? [entry.severity, ...entry.options]
        : entry.severity;
      rulesObject[entry.ruleName] = value;
    }

    const linter = new Linter();
    const messages = linter.verify(
      'export const x: number = 1;\n',
      [{
        files: ['**/*.ts'],
        languageOptions: {
          parser: tseslintParser as unknown as Linter.Parser,
          parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        plugins: {
          '@typescript-eslint': tseslintPlugin as unknown as Linter.Plugin,
          'import': importPlugin as unknown as Linter.Plugin,
          'jsdoc': jsdocPlugin as unknown as Linter.Plugin,
          'unicorn': unicornPlugin as unknown as Linter.Plugin,
        },
        rules: rulesObject as Linter.RulesRecord,
      }],
      { filename: 'sample.ts' },
    );

    const definitionErrors = messages.filter((m) =>
      typeof m.message === 'string' && m.message.includes('Definition for rule')
    );
    expect(
      definitionErrors,
      `ESLint reported missing rule definitions:\n${definitionErrors.map((m) => `  - ${m.ruleId}: ${m.message}`).join('\n')}`,
    ).toEqual([]);

    const fatalErrors = messages.filter((m) => m.fatal === true);
    expect(
      fatalErrors,
      `ESLint reported fatal errors:\n${fatalErrors.map((m) => `  - ${m.ruleId ?? '?'}: ${m.message}`).join('\n')}`,
    ).toEqual([]);
  });
});
