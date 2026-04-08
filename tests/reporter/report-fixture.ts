/**
 * Shared test fixture: a known AdherenceReport for reporter tests.
 *
 * Contains 3 rules (2 passing, 1 failing) with evidence,
 * covering multiple categories.
 */

import type { AdherenceReport, AgentRun, RuleSet, RuleResult, Rule } from '../../src/types.js';

const passingRule1: Rule = {
  id: 'camelcase-variables',
  category: 'naming',
  source: 'Use camelCase for variables',
  description: 'camelCase variables',
  severity: 'error',
  verifier: 'ast',
  pattern: { type: 'camelCase', target: 'variables', expected: true, scope: 'file' },
};

const passingRule2: Rule = {
  id: 'no-console-log',
  category: 'forbidden-pattern',
  source: 'No console.log in production code',
  description: 'no console.log',
  severity: 'error',
  verifier: 'ast',
  pattern: { type: 'no-console-log', target: '*', expected: true, scope: 'file' },
};

const failingRule: Rule = {
  id: 'no-any-type',
  category: 'forbidden-pattern',
  source: 'Never use any type',
  description: 'no any type',
  severity: 'error',
  verifier: 'ast',
  pattern: { type: 'no-any', target: '*', expected: true, scope: 'file' },
};

const passingResult1: RuleResult = {
  rule: passingRule1,
  passed: true,
  evidence: [],
};

const passingResult2: RuleResult = {
  rule: passingRule2,
  passed: true,
  evidence: [],
};

const failingResult: RuleResult = {
  rule: failingRule,
  passed: false,
  evidence: [
    {
      file: '/output/src/handler.ts',
      line: 12,
      found: 'req: any',
      expected: 'no any type',
      context: 'export function handle(req: any) {',
    },
    {
      file: '/output/src/handler.ts',
      line: 24,
      found: 'data: any',
      expected: 'no any type',
      context: 'const data: any = fetchData();',
    },
  ],
};

const run: AgentRun = {
  agent: 'test-agent',
  model: 'test-model-v1',
  taskTemplateId: 'rest-endpoint',
  outputDir: '/output',
  timestamp: '2026-04-06T14:30:00Z',
  durationSeconds: null,
};

const ruleSet: RuleSet = {
  sourceFile: 'CLAUDE.md',
  sourceType: 'claude.md',
  rules: [passingRule1, passingRule2, failingRule],
  unparseable: ['Write clean code'],
};

const results: RuleResult[] = [passingResult1, passingResult2, failingResult];

export const testReport: AdherenceReport = {
  run,
  ruleset: ruleSet,
  results,
  summary: {
    totalRules: 3,
    passed: 2,
    failed: 1,
    skipped: 0,
    warnings: 0,
    adherenceScore: (2 / 3) * 100,
    byCategory: {
      'naming': { passed: 1, total: 1 },
      'forbidden-pattern': { passed: 1, total: 2 },
      'structure': { passed: 0, total: 0 },
      'test-requirement': { passed: 0, total: 0 },
      'import-pattern': { passed: 0, total: 0 },
    },
  },
};

/**
 * A second report for comparison tests: all rules fail.
 */
export const testReportFailing: AdherenceReport = {
  run: { ...run, agent: 'bad-agent', model: 'bad-model-v1', outputDir: '/output-bad' },
  ruleset: ruleSet,
  results: [
    { ...passingResult1, passed: false, evidence: [{ file: '/output-bad/src/main.ts', line: 5, found: 'Bad_Name', expected: 'camelCase', context: 'const Bad_Name = 1;' }] },
    { ...passingResult2, passed: false, evidence: [{ file: '/output-bad/src/main.ts', line: 10, found: 'console.log("x")', expected: 'no console.log', context: 'console.log("x");' }] },
    { ...failingResult },
  ],
  summary: {
    totalRules: 3,
    passed: 0,
    failed: 3,
    skipped: 0,
    warnings: 0,
    adherenceScore: 0,
    byCategory: {
      'naming': { passed: 0, total: 1 },
      'forbidden-pattern': { passed: 0, total: 2 },
      'structure': { passed: 0, total: 0 },
      'test-requirement': { passed: 0, total: 0 },
      'import-pattern': { passed: 0, total: 0 },
    },
  },
};
