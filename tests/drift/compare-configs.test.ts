/**
 * Tests for the drift comparison logic.
 *
 * Validates that compareConfigs correctly identifies md-only rules,
 * eslint-only rules, severity mismatches, config-arg mismatches, and
 * that unparseable rules from CLAUDE.md are excluded from drift.
 */

import { describe, it, expect } from 'vitest';
import { compareConfigs } from '../../src/drift/compare-configs.js';
import type { EslintConfig, EslintRuleEntry } from '../../src/mapper/types.js';
import type { ParsedEslintConfig } from '../../src/drift/types.js';

/** Build a minimal EslintConfig for testing. */
function makeMdConfig(rules: EslintRuleEntry[], overrides?: Partial<EslintConfig>): EslintConfig {
  return {
    rules,
    unmappable: [],
    plugins: [],
    sourceFile: 'test-claude.md',
    ...overrides,
  };
}

/** Build a single EslintRuleEntry. */
function makeMdRule(overrides: Partial<EslintRuleEntry> & { ruleName: string }): EslintRuleEntry {
  return {
    severity: 'error',
    sourceRuleId: 'test-rule-1',
    description: 'test rule',
    ...overrides,
  };
}

/** Build a minimal ParsedEslintConfig for testing. */
function makeFileConfig(rules: { ruleName: string; severity: 'error' | 'warn' | 'off'; options?: unknown[] }[]): ParsedEslintConfig {
  return {
    rules: rules.map((r) => ({
      ruleName: r.ruleName,
      severity: r.severity,
      options: r.options ?? [],
    })),
    sourceFile: '.eslintrc.json',
  };
}

describe('compareConfigs', () => {
  it('returns empty drift when configs are in sync', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.items).toHaveLength(0);
    expect(result.hasDrift).toBe(false);
  });

  it('detects md-only rules (in CLAUDE.md but not in eslint config)', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
      makeMdRule({
        ruleName: '@typescript-eslint/no-explicit-any',
        severity: 'error',
        sourceRuleId: 'forbidden-no-any-type-1',
        description: 'No any type',
      }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const mdOnly = result.items.filter((i) => i.kind === 'md-only');
    expect(mdOnly).toHaveLength(1);
    expect(mdOnly[0].ruleName).toBe('@typescript-eslint/no-explicit-any');
    expect(mdOnly[0].mdRuleId).toBe('forbidden-no-any-type-1');
    expect(mdOnly[0].mdDescription).toBe('No any type');
  });

  it('detects eslint-only rules (in eslint config but not in CLAUDE.md)', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
      { ruleName: 'sonarjs/no-identical-conditions', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const eslintOnly = result.items.filter((i) => i.kind === 'eslint-only');
    expect(eslintOnly).toHaveLength(1);
    expect(eslintOnly[0].ruleName).toBe('sonarjs/no-identical-conditions');
  });

  it('detects severity mismatches (error vs warn)', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'warn' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const severityDrift = result.items.filter((i) => i.kind === 'severity-mismatch');
    expect(severityDrift).toHaveLength(1);
    expect(severityDrift[0].ruleName).toBe('no-console');
    expect(severityDrift[0].mdSeverity).toBe('error');
    expect(severityDrift[0].eslintSeverity).toBe('warn');
  });

  it('detects config-arg mismatches (different options)', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({
        ruleName: 'max-lines',
        severity: 'error',
        options: [{ max: 300, skipBlankLines: true, skipComments: true }],
      }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'max-lines', severity: 'error', options: [{ max: 500 }] },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const argDrift = result.items.filter((i) => i.kind === 'config-arg-mismatch');
    expect(argDrift).toHaveLength(1);
    expect(argDrift[0].ruleName).toBe('max-lines');
    expect(argDrift[0].mdOptions).toEqual([{ max: 300, skipBlankLines: true, skipComments: true }]);
    expect(argDrift[0].eslintOptions).toEqual([{ max: 500 }]);
  });

  it('does not report unparseable md rules as drift', () => {
    const mdConfig = makeMdConfig(
      [makeMdRule({ ruleName: 'no-console', severity: 'error' })],
      { unmappable: [{ sourceRuleId: 'test-files-exist-1', sourceText: 'Every file needs a test', reason: 'No ESLint rule enforces test file existence' }] },
    );
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it('detects md-only rules that are disabled (off) in eslint config', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'off' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const mdOnly = result.items.filter((i) => i.kind === 'md-only');
    expect(mdOnly).toHaveLength(1);
    expect(mdOnly[0].ruleName).toBe('no-console');
  });

  it('reports a rule disabled in eslint but present in md as md-only, not severity-mismatch', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'off' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    const severityDrift = result.items.filter((i) => i.kind === 'severity-mismatch');
    expect(severityDrift).toHaveLength(0);
  });

  it('detects both md-only and eslint-only in the same comparison', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
      makeMdRule({ ruleName: 'prefer-const', severity: 'warn' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
      { ruleName: 'sonarjs/no-identical-conditions', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(true);
    const mdOnly = result.items.filter((i) => i.kind === 'md-only');
    const eslintOnly = result.items.filter((i) => i.kind === 'eslint-only');
    expect(mdOnly).toHaveLength(1);
    expect(mdOnly[0].ruleName).toBe('prefer-const');
    expect(eslintOnly).toHaveLength(1);
    expect(eslintOnly[0].ruleName).toBe('sonarjs/no-identical-conditions');
  });

  it('includes source file paths in the result', () => {
    const mdConfig = makeMdConfig([]);
    const fileConfig = makeFileConfig([]);

    const result = compareConfigs(
      { ...mdConfig, sourceFile: 'path/to/CLAUDE.md' },
      { ...fileConfig, sourceFile: 'path/to/.eslintrc.json' },
    );
    expect(result.mdFile).toBe('path/to/CLAUDE.md');
    expect(result.eslintFile).toBe('path/to/.eslintrc.json');
  });

  it('detects config-arg mismatch when md has options but eslint has none', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({
        ruleName: 'max-lines',
        severity: 'error',
        options: [{ max: 300 }],
      }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'max-lines', severity: 'error', options: [] },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    const argDrift = result.items.filter((i) => i.kind === 'config-arg-mismatch');
    expect(argDrift).toHaveLength(1);
  });

  it('reports eslint-only for plugin rules never mentioned in CLAUDE.md', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'no-console', severity: 'error' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'no-console', severity: 'error' },
      { ruleName: 'sonarjs/no-identical-conditions', severity: 'error' },
      { ruleName: 'import/no-cycle', severity: 'warn' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    const eslintOnly = result.items.filter((i) => i.kind === 'eslint-only');
    expect(eslintOnly).toHaveLength(2);
    const names = eslintOnly.map((i) => i.ruleName).sort();
    expect(names).toEqual(['import/no-cycle', 'sonarjs/no-identical-conditions']);
  });

  it('detects severity mismatch when md says warn but eslint says error', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({ ruleName: 'prefer-const', severity: 'warn' }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'prefer-const', severity: 'error' },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    const severityDrift = result.items.filter((i) => i.kind === 'severity-mismatch');
    expect(severityDrift).toHaveLength(1);
    expect(severityDrift[0].mdSeverity).toBe('warn');
    expect(severityDrift[0].eslintSeverity).toBe('error');
  });

  it('considers same severity and same options as in-sync', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({
        ruleName: 'max-lines',
        severity: 'error',
        options: [{ max: 300 }],
      }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'max-lines', severity: 'error', options: [{ max: 300 }] },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    expect(result.hasDrift).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it('does not double-count a rule as both severity and config-arg mismatch', () => {
    const mdConfig = makeMdConfig([
      makeMdRule({
        ruleName: 'max-lines',
        severity: 'warn',
        options: [{ max: 300 }],
      }),
    ]);
    const fileConfig = makeFileConfig([
      { ruleName: 'max-lines', severity: 'error', options: [{ max: 500 }],
      },
    ]);

    const result = compareConfigs(mdConfig, fileConfig);
    // Should report as config-arg mismatch since options differ (which subsumes severity)
    // OR report both separately. The spec says "config-arg mismatch" covers option differences.
    // Both severity and options differ, so we report a config-arg-mismatch that includes severity info.
    const mismatches = result.items.filter(
      (i) => i.kind === 'severity-mismatch' || i.kind === 'config-arg-mismatch',
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('config-arg-mismatch');
    expect(mismatches[0].mdSeverity).toBe('warn');
    expect(mismatches[0].eslintSeverity).toBe('error');
  });
});