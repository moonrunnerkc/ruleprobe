import { describe, it, expect } from 'vitest';
import { formatJson } from '../../src/reporter/json.js';
import { testReport } from './report-fixture.js';

describe('JSON reporter', () => {
  it('produces valid JSON', () => {
    const output = formatJson(testReport);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('round-trips the report data', () => {
    const output = formatJson(testReport);
    const parsed = JSON.parse(output);
    expect(parsed.run.agent).toBe('test-agent');
    expect(parsed.run.model).toBe('test-model-v1');
    expect(parsed.summary.totalRules).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.adherenceScore).toBeCloseTo(66.67, 1);
  });

  it('includes all results', () => {
    const output = formatJson(testReport);
    const parsed = JSON.parse(output);
    expect(parsed.results).toHaveLength(3);
    expect(parsed.results[0].passed).toBe(true);
    expect(parsed.results[2].passed).toBe(false);
  });

  it('includes evidence on failing results', () => {
    const output = formatJson(testReport);
    const parsed = JSON.parse(output);
    const failing = parsed.results.find(
      (r: { rule: { id: string } }) => r.rule.id === 'no-any-type',
    );
    expect(failing.evidence).toHaveLength(2);
    expect(failing.evidence[0].found).toBe('req: any');
  });

  it('includes the full ruleset', () => {
    const output = formatJson(testReport);
    const parsed = JSON.parse(output);
    expect(parsed.ruleset.sourceFile).toBe('CLAUDE.md');
    expect(parsed.ruleset.rules).toHaveLength(3);
    expect(parsed.ruleset.unparseable).toContain('Write clean code');
  });

  it('uses 2-space indentation', () => {
    const output = formatJson(testReport);
    // The second line should start with 2 spaces (first key in the object)
    const lines = output.split('\n');
    expect(lines[1]).toMatch(/^ {2}"/);
  });
});
