/**
 * Tests for the PR comment formatting module.
 *
 * Validates that drift results are formatted as well-structured
 * markdown comments with summary lines, collapsible details, and
 * the dedup marker.
 */

import { describe, it, expect } from 'vitest';
import { formatDriftComment, formatDriftSummary } from '../../src/action/comment.js';
import type { DriftResult } from '../../src/drift/types.js';

const noDriftResult: DriftResult = {
  items: [],
  mdFile: 'CLAUDE.md',
  eslintFile: '.eslintrc.json',
  hasDrift: false,
};

const driftResult: DriftResult = {
  items: [
    {
      kind: 'md-only',
      ruleName: '@typescript-eslint/no-explicit-any',
      mdRuleId: 'no-any',
      mdDescription: 'Never use any',
      mdSeverity: 'error',
      message: '@typescript-eslint/no-explicit-any is in CLAUDE.md but not in eslint config',
    },
    {
      kind: 'eslint-only',
      ruleName: 'no-console',
      eslintSeverity: 'warn',
      message: 'no-console is in eslint config but not derived from CLAUDE.md',
    },
    {
      kind: 'severity-mismatch',
      ruleName: 'prefer-const',
      mdSeverity: 'error',
      eslintSeverity: 'warn',
      message: 'prefer-const: CLAUDE.md says error, eslint says warn',
    },
  ],
  mdFile: 'CLAUDE.md',
  eslintFile: '.eslintrc.json',
  hasDrift: true,
};

const longDriftResult: DriftResult = {
  items: [
    ...Array.from({ length: 15 }, (_, i) => ({
      kind: 'md-only' as const,
      ruleName: `rule-${i}`,
      mdRuleId: `rule-${i}`,
      mdDescription: `Rule ${i} description`,
      mdSeverity: 'error' as const,
      message: `rule-${i} is in CLAUDE.md but not in eslint config`,
    })),
  ],
  mdFile: 'CLAUDE.md',
  eslintFile: 'eslint.config.js',
  hasDrift: true,
};

describe('formatDriftSummary', () => {
  it('formats zero drift', () => {
    expect(formatDriftSummary(0)).toBe('No drift detected');
  });

  it('formats single drift issue', () => {
    expect(formatDriftSummary(1)).toBe('1 drift issue detected');
  });

  it('formats multiple drift issues', () => {
    expect(formatDriftSummary(5)).toBe('5 drift issues detected');
  });
});

describe('formatDriftComment', () => {
  it('includes the dedup marker', () => {
    const comment = formatDriftComment(noDriftResult);
    expect(comment).toContain('<!-- ruleprobe-drift -->');
  });

  it('includes "No drift detected" when no drift', () => {
    const comment = formatDriftComment(noDriftResult);
    expect(comment).toContain('No drift detected');
  });

  it('includes summary line with drift count', () => {
    const comment = formatDriftComment(driftResult);
    expect(comment).toContain('3 drift issues detected');
  });

  it('includes a markdown table for drift items', () => {
    const comment = formatDriftComment(driftResult);
    expect(comment).toContain('| Kind | Rule |');
    expect(comment).toContain('| md-only');
    expect(comment).toContain('@typescript-eslint/no-explicit-any');
  });

  it('includes severity info in the table', () => {
    const comment = formatDriftComment(driftResult);
    expect(comment).toContain('severity-mismatch');
    expect(comment).toContain('prefer-const');
  });

  it('wraps long drift results in a collapsible details block', () => {
    const comment = formatDriftComment(longDriftResult);
    expect(comment).toContain('<details>');
    expect(comment).toContain('</details>');
    expect(comment).toContain('15 drift issues');
  });

  it('does not wrap short drift results in details block', () => {
    const comment = formatDriftComment(driftResult);
    expect(comment).not.toContain('<details>');
  });

  it('includes the instruction file and eslint file paths', () => {
    const comment = formatDriftComment(driftResult);
    expect(comment).toContain('CLAUDE.md');
    expect(comment).toContain('.eslintrc.json');
  });

  it('formats no-drift result without a table', () => {
    const comment = formatDriftComment(noDriftResult);
    expect(comment).not.toContain('| Kind |');
  });
});