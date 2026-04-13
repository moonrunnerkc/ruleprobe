/**
 * Tests for the rdjson (reviewdog) report formatter.
 *
 * Verifies that AdherenceReports are correctly transformed into
 * reviewdog's rdjson Diagnostic format with proper file paths,
 * line numbers, severity mappings, and source metadata.
 */

import { describe, it, expect } from 'vitest';
import { formatRdjson } from '../../src/reporter/rdjson.js';
import { testReport, testReportFailing } from './report-fixture.js';
import type { AdherenceReport, Rule, RuleResult } from '../../src/types.js';

describe('formatRdjson', () => {
  it('produces valid JSON output', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
    expect(parsed.source).toBeDefined();
    expect(parsed.diagnostics).toBeInstanceOf(Array);
  });

  it('sets source field correctly', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    expect(parsed.source.name).toBe('ruleprobe');
    expect(parsed.source.url).toBe('https://github.com/moonrunnerkc/ruleprobe');
  });

  it('excludes passing rules from diagnostics', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    // testReport has 2 passing, 1 failing with 2 evidence entries
    expect(parsed.diagnostics.length).toBe(2);
    for (const diag of parsed.diagnostics) {
      expect(diag.code.value).toBe('no-any-type');
    }
  });

  it('maps each evidence entry to a separate diagnostic', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    // The failing rule "no-any-type" has 2 evidence entries
    expect(parsed.diagnostics.length).toBe(2);
    expect(parsed.diagnostics[0].location.path).toBe('src/handler.ts');
    expect(parsed.diagnostics[1].location.path).toBe('src/handler.ts');
  });

  it('sets file path and line number correctly', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    const first = parsed.diagnostics[0];
    expect(first.location.path).toBe('src/handler.ts');
    expect(first.location.range.start.line).toBe(12);
  });

  it('includes rule description and found text in message', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    const first = parsed.diagnostics[0];
    expect(first.message).toContain('no any type');
    expect(first.message).toContain('req: any');
  });

  it('maps error severity to ERROR', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    for (const diag of parsed.diagnostics) {
      expect(diag.severity).toBe('ERROR');
    }
  });

  it('maps warning severity to WARNING', () => {
    const warningRule: Rule = {
      id: 'style-indent',
      category: 'structure',
      source: 'Use 2-space indentation',
      description: '2-space indentation',
      severity: 'warning',
      verifier: 'regex',
      pattern: { type: 'indentation', target: '*', expected: '2', scope: 'file' },
    };

    const warningResult: RuleResult = {
      rule: warningRule,
      passed: false,
      compliance: 0,
      evidence: [{
        file: '/output/src/index.ts',
        line: 5,
        found: '4-space indent',
        expected: '2-space indent',
        context: '    const x = 1;',
      }],
    };

    const warningReport: AdherenceReport = {
      run: testReport.run,
      ruleset: { ...testReport.ruleset, rules: [warningRule] },
      results: [warningResult],
      summary: {
        totalRules: 1, passed: 0, failed: 1, warnings: 1,
        adherenceScore: 0,
        byCategory: {
          'naming': { passed: 0, total: 0 },
          'forbidden-pattern': { passed: 0, total: 0 },
          'structure': { passed: 0, total: 1 },
          'test-requirement': { passed: 0, total: 0 },
          'import-pattern': { passed: 0, total: 0 },
        },
      },
    };

    const output = formatRdjson(warningReport);
    const parsed = JSON.parse(output);
    expect(parsed.diagnostics[0].severity).toBe('WARNING');
  });

  it('sets code.value to the rule id', () => {
    const output = formatRdjson(testReport);
    const parsed = JSON.parse(output);
    for (const diag of parsed.diagnostics) {
      expect(diag.code.value).toBe('no-any-type');
    }
  });

  it('produces diagnostics for all failures in a fully-failing report', () => {
    const output = formatRdjson(testReportFailing);
    const parsed = JSON.parse(output);
    // testReportFailing: 3 rules, all fail
    // rule 1 (camelcase): 1 evidence, rule 2 (console-log): 1 evidence, rule 3 (no-any): 2 evidence
    expect(parsed.diagnostics.length).toBe(4);
  });

  it('handles a file-level evidence entry without a line number', () => {
    const fileRule: Rule = {
      id: 'kebab-files',
      category: 'naming',
      source: 'Use kebab-case file names',
      description: 'kebab-case file names',
      severity: 'error',
      verifier: 'filesystem',
      pattern: { type: 'kebab-case', target: '*.ts', expected: true, scope: 'project' },
    };

    const fileResult: RuleResult = {
      rule: fileRule,
      passed: false,
      compliance: 0,
      evidence: [{
        file: '/output/src/MyComponent.ts',
        line: null,
        found: 'MyComponent.ts',
        expected: 'kebab-case',
        context: '',
      }],
    };

    const fileReport: AdherenceReport = {
      run: testReport.run,
      ruleset: { ...testReport.ruleset, rules: [fileRule] },
      results: [fileResult],
      summary: {
        totalRules: 1, passed: 0, failed: 1, warnings: 0,
        adherenceScore: 0,
        byCategory: {
          'naming': { passed: 0, total: 1 },
          'forbidden-pattern': { passed: 0, total: 0 },
          'structure': { passed: 0, total: 0 },
          'test-requirement': { passed: 0, total: 0 },
          'import-pattern': { passed: 0, total: 0 },
        },
      },
    };

    const output = formatRdjson(fileReport);
    const parsed = JSON.parse(output);
    expect(parsed.diagnostics.length).toBe(1);
    expect(parsed.diagnostics[0].location.path).toBe('src/MyComponent.ts');
    expect(parsed.diagnostics[0].location.range).toBeUndefined();
  });

  it('returns an empty diagnostics array when all rules pass', () => {
    const passingReport: AdherenceReport = {
      ...testReport,
      results: testReport.results.filter((r) => r.passed),
      summary: {
        ...testReport.summary,
        totalRules: 2, passed: 2, failed: 0,
        adherenceScore: 100,
      },
    };

    const output = formatRdjson(passingReport);
    const parsed = JSON.parse(output);
    expect(parsed.diagnostics).toEqual([]);
  });
});
