// Tests for the summary statistics line appended to verification output.
// Covers generateReport skipped computation, formatTextPlain output placement,
// and integration between ruleset filtering and the final summary line.

import { describe, it, expect } from 'vitest';
import { generateReport } from '../../src/index.js';
import { formatTextPlain } from '../../src/reporter/text.js';
import type { AgentRun, RuleSet, RuleResult, Rule } from '../../src/types.js';

const baseRun: AgentRun = {
  agent: 'test-agent',
  model: 'gpt-4',
  taskTemplateId: 'rest-endpoint',
  outputDir: '/out',
  timestamp: '2026-04-08T00:00:00Z',
  durationSeconds: null,
};

function makeRule(id: string, severity: 'error' | 'warning' = 'error'): Rule {
  return {
    id,
    category: 'naming',
    source: `Rule ${id}`,
    description: id,
    severity,
    verifier: 'ast',
    pattern: { type: 'camelCase', target: 'variables', expected: true, scope: 'file' },
  };
}

function makeResult(rule: Rule, passed: boolean): RuleResult {
  return {
    rule,
    passed,
    evidence: passed ? [] : [{ file: '/out/src/a.ts', line: 1, found: 'bad', expected: 'good', context: '' }],
  };
}

const ruleA = makeRule('rule-a');
const ruleB = makeRule('rule-b');
const ruleC = makeRule('rule-c');
const ruleD = makeRule('rule-d', 'warning');

const fullRuleSet: RuleSet = {
  sourceFile: 'CLAUDE.md',
  sourceType: 'claude.md',
  rules: [ruleA, ruleB, ruleC, ruleD],
  unparseable: [],
};

describe('generateReport: skipped computation', () => {
  it('sets skipped to 0 when all ruleset rules are in results', () => {
    const results = [
      makeResult(ruleA, true),
      makeResult(ruleB, false),
      makeResult(ruleC, true),
      makeResult(ruleD, false),
    ];
    const report = generateReport(baseRun, fullRuleSet, results);
    expect(report.summary.skipped).toBe(0);
  });

  it('counts skipped when results are fewer than ruleset rules', () => {
    // Simulate severity filter: only 2 of 4 rules in results
    const results = [makeResult(ruleA, true), makeResult(ruleB, false)];
    const report = generateReport(baseRun, fullRuleSet, results);
    expect(report.summary.skipped).toBe(2);
  });

  it('marks all as skipped when results is empty', () => {
    const report = generateReport(baseRun, fullRuleSet, []);
    expect(report.summary.skipped).toBe(4);
    expect(report.summary.totalRules).toBe(0);
    expect(report.summary.passed).toBe(0);
    expect(report.summary.failed).toBe(0);
  });

  it('totalRules reflects results length, not ruleset length', () => {
    const results = [makeResult(ruleA, true), makeResult(ruleB, false)];
    const report = generateReport(baseRun, fullRuleSet, results);
    expect(report.summary.totalRules).toBe(2);
  });

  it('skipped plus totalRules equals ruleset rules count', () => {
    const results = [makeResult(ruleA, true), makeResult(ruleB, false), makeResult(ruleC, true)];
    const report = generateReport(baseRun, fullRuleSet, results);
    expect(report.summary.skipped + report.summary.totalRules).toBe(fullRuleSet.rules.length);
  });
});

describe('formatTextPlain: summary line at end', () => {
  it('includes "Summary:" line after By Category section', () => {
    const results = [makeResult(ruleA, true), makeResult(ruleB, false)];
    const report = generateReport(baseRun, fullRuleSet, results);
    const output = formatTextPlain(report);

    const categoryIdx = output.indexOf('By Category:');
    const summaryIdx = output.indexOf('Summary:');
    expect(summaryIdx).toBeGreaterThan(categoryIdx);
  });

  it('shows checked, passed, failed, skipped counts in summary line', () => {
    const results = [makeResult(ruleA, true), makeResult(ruleB, false)];
    const report = generateReport(baseRun, fullRuleSet, results);
    const output = formatTextPlain(report);
    // 2 checked, 1 passed, 1 failed, 2 skipped (ruleC + ruleD filtered)
    expect(output).toContain('Summary: 2 checked | 1 passed | 1 failed | 2 skipped');
  });

  it('shows 0 skipped when all rules are checked', () => {
    const results = [
      makeResult(ruleA, true),
      makeResult(ruleB, false),
      makeResult(ruleC, true),
      makeResult(ruleD, false),
    ];
    const report = generateReport(baseRun, fullRuleSet, results);
    const output = formatTextPlain(report);
    expect(output).toContain('4 checked');
    expect(output).toContain('0 skipped');
  });

  it('summary line is the last non-empty content in the output', () => {
    const results = [makeResult(ruleA, true), makeResult(ruleB, false)];
    const report = generateReport(baseRun, fullRuleSet, results);
    const output = formatTextPlain(report);
    const lines = output.split('\n').filter((l) => l.trim() !== '');
    expect(lines[lines.length - 1]).toMatch(/^Summary:/);
  });

  it('correctly renders all-pass scenario', () => {
    const singleRuleSet: RuleSet = { ...fullRuleSet, rules: [ruleA] };
    const results = [makeResult(ruleA, true)];
    const report = generateReport(baseRun, singleRuleSet, results);
    const output = formatTextPlain(report);
    expect(output).toContain('Summary: 1 checked | 1 passed | 0 failed | 0 skipped');
  });

  it('correctly renders all-fail scenario', () => {
    const singleRuleSet: RuleSet = { ...fullRuleSet, rules: [ruleA] };
    const results = [makeResult(ruleA, false)];
    const report = generateReport(baseRun, singleRuleSet, results);
    const output = formatTextPlain(report);
    expect(output).toContain('Summary: 1 checked | 0 passed | 1 failed | 0 skipped');
  });
});
