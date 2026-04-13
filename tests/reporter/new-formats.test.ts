/**
 * Tests for new report formatters: summary, detailed, and CI.
 *
 * Uses the shared report fixture to test output generation
 * for each new format.
 */

import { describe, it, expect } from 'vitest';
import { formatReport } from '../../src/reporter/index.js';
import type { AdherenceReport, AgentRun, RuleSet, RuleResult, ReportSummary } from '../../src/types.js';

function makeReport(): AdherenceReport {
  const run: AgentRun = {
    agent: 'test-agent',
    model: 'test-model',
    task: 'manual',
    timestamp: new Date('2025-01-01').toISOString(),
  };

  const rules: RuleResult[] = [
    {
      rule: {
        id: 'naming-camelcase-1',
        source: 'Use camelCase',
        category: 'naming',
        severity: 'error',
        verifier: 'ast',
        pattern: { type: 'camelCase', target: '*.ts', expected: 'camelCase', scope: 'file' },
      },
      passed: true,
      compliance: 1,
      evidence: [],
    },
    {
      rule: {
        id: 'forbidden-console-log-2',
        source: 'No console.log',
        category: 'forbidden-pattern',
        severity: 'error',
        verifier: 'regex',
        pattern: { type: 'forbidden-call', target: '*.ts', expected: 'console.log', scope: 'file' },
      },
      passed: false,
      compliance: 0,
      evidence: [{
        file: 'src/app.ts',
        line: 10,
        found: 'console.log("debug")',
        expected: 'no console.log calls',
        context: 'console.log("debug")',
      }],
    },
  ];

  const ruleSet: RuleSet = {
    sourceFile: 'CLAUDE.md',
    sourceType: 'claude.md',
    rules: rules.map((r) => r.rule),
    unparseable: [],
  };

  const summary: ReportSummary = {
    totalRules: 2,
    passed: 1,
    failed: 1,
    skipped: 0,
    warnings: 0,
    adherenceScore: 50,
    byCategory: {
      'naming': { passed: 1, total: 1 },
      'forbidden-pattern': { passed: 0, total: 1 },
      'structure': { passed: 0, total: 0 },
      'test-requirement': { passed: 0, total: 0 },
      'import-pattern': { passed: 0, total: 0 },
      'error-handling': { passed: 0, total: 0 },
      'type-safety': { passed: 0, total: 0 },
      'code-style': { passed: 0, total: 0 },
      'dependency': { passed: 0, total: 0 },
      'preference': { passed: 0, total: 0 },
      'file-structure': { passed: 0, total: 0 },
      'tooling': { passed: 0, total: 0 },
      'testing': { passed: 0, total: 0 },
    },
  };

  return { run, ruleset: ruleSet, results: rules, summary };
}

describe('summary format', () => {
  it('produces table with categories and overall score', () => {
    const report = makeReport();
    const output = formatReport(report, 'summary');
    expect(output).toContain('RuleProbe Summary');
    expect(output).toContain('OVERALL');
    expect(output).toContain('50%');
  });

  it('includes only categories with rules', () => {
    const report = makeReport();
    const output = formatReport(report, 'summary');
    expect(output).toContain('naming');
    expect(output).toContain('forbidden-pattern');
    expect(output).not.toContain('error-handling');
  });
});

describe('detailed format', () => {
  it('produces markdown with evidence details', () => {
    const report = makeReport();
    const output = formatReport(report, 'detailed');
    expect(output).toContain('Detailed');
    expect(output).toContain('console.log');
  });

  it('includes pass/fail indicators', () => {
    const report = makeReport();
    const output = formatReport(report, 'detailed');
    expect(output).toMatch(/pass|fail|✓|✗|PASS|FAIL/i);
  });
});

describe('ci format', () => {
  it('produces parseable CI output', () => {
    const report = makeReport();
    const output = formatReport(report, 'ci');
    expect(output).toContain('status=fail');
    expect(output).toContain('console.log');
  });

  it('includes score line', () => {
    const report = makeReport();
    const output = formatReport(report, 'ci');
    expect(output).toContain('50');
  });
});
