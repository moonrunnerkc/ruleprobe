// Tests for the Markdown report formatter.

import { describe, it, expect } from 'vitest';
import { formatMarkdown } from '../../src/reporter/markdown.js';
import { testReport } from './report-fixture.js';

describe('Markdown reporter: single report', () => {
  it('includes a top-level heading', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('# RuleProbe Adherence Report');
  });

  it('includes agent, model, and task metadata', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('**Agent:** test-agent');
    expect(output).toContain('**Model:** test-model-v1');
    expect(output).toContain('**Task:** rest-endpoint');
  });

  it('includes pass/fail counts and score', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('3 total');
    expect(output).toContain('2 passed');
    expect(output).toContain('1 failed');
    expect(output).toContain('67%');
  });

  it('shows PASS results', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('PASS: naming/camelcase-variables');
    expect(output).toContain('PASS: forbidden-pattern/no-console-log');
  });

  it('shows FAIL results with evidence in code blocks', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('FAIL: forbidden-pattern/no-any-type');
    expect(output).toContain('```');
    expect(output).toContain('src/handler.ts:12 - found: req: any');
  });

  it('includes a category summary table', () => {
    const output = formatMarkdown(testReport);
    expect(output).toContain('## Category Summary');
    expect(output).toContain('| Category | Passed | Total | Score |');
    expect(output).toContain('| naming | 1 | 1 | 100% |');
    expect(output).toContain('| forbidden-pattern | 1 | 2 | 50% |');
  });
});