import { describe, it, expect } from 'vitest';
import { formatTextPlain, formatParseText } from '../../src/reporter/text.js';
import { testReport } from './report-fixture.js';

describe('Text reporter', () => {
  it('includes the header with agent, model, and task', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('RuleProbe Adherence Report');
    expect(output).toContain('Agent: test-agent');
    expect(output).toContain('Model: test-model-v1');
    expect(output).toContain('Task: rest-endpoint');
  });

  it('includes the date', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('2026-04-06T14:30:00Z');
  });

  it('shows correct pass/fail counts and score', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('3 total');
    expect(output).toContain('2 passed');
    expect(output).toContain('1 failed');
    expect(output).toContain('67%');
  });

  it('shows PASS for passing rules', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('PASS  naming/camelcase-variables');
    expect(output).toContain('PASS  forbidden-pattern/no-console-log');
  });

  it('shows FAIL with evidence for failing rules', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('FAIL  forbidden-pattern/no-any-type');
    expect(output).toContain('src/handler.ts:12');
    expect(output).toContain('found: req: any');
    expect(output).toContain('src/handler.ts:24');
    expect(output).toContain('found: data: any');
  });

  it('shows category summary with percentages', () => {
    const output = formatTextPlain(testReport);
    expect(output).toContain('By Category:');
    expect(output).toContain('naming:');
    expect(output).toContain('1/1 (100%)');
    expect(output).toContain('forbidden-pattern:');
    expect(output).toContain('1/2 (50%)');
  });

  it('omits categories with zero rules', () => {
    const output = formatTextPlain(testReport);
    expect(output).not.toContain('structure:');
    expect(output).not.toContain('import-pattern:');
    expect(output).not.toContain('test-requirement:');
  });
});

describe('Text parse formatter', () => {
  it('lists all extracted rules', () => {
    const output = formatParseText(
      testReport.ruleset.rules,
      testReport.ruleset.unparseable,
      false,
    );
    expect(output).toContain('Extracted 3 rules');
    expect(output).toContain('camelcase-variables');
    expect(output).toContain('no-console-log');
    expect(output).toContain('no-any-type');
  });

  it('shows unparseable lines when requested', () => {
    const output = formatParseText(
      testReport.ruleset.rules,
      testReport.ruleset.unparseable,
      true,
    );
    expect(output).toContain('Unparseable lines (1)');
    expect(output).toContain('Write clean code');
  });

  it('hides unparseable lines by default', () => {
    const output = formatParseText(
      testReport.ruleset.rules,
      testReport.ruleset.unparseable,
      false,
    );
    expect(output).not.toContain('Unparseable');
  });
});
