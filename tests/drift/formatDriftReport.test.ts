/**
 * Tests for drift report formatting.
 *
 * Validates text, JSON, and markdown output formats.
 */

import { describe, it, expect } from 'vitest';
import { formatDriftReport } from '../../src/drift/formatDriftReport.js';
import type { DriftResult, DriftItem } from '../../src/drift/types.js';

/** Build a minimal DriftItem. */
function makeDriftItem(overrides: Partial<DriftItem> & { kind: DriftItem['kind']; ruleName: string }): DriftItem {
  return { message: 'test drift', ...overrides };
}

/** Build a minimal DriftResult. */
function makeDriftResult(items: DriftItem[]): DriftResult {
  return {
    items,
    mdFile: 'CLAUDE.md',
    eslintFile: '.eslintrc.json',
    hasDrift: items.length > 0,
  };
}

describe('formatDriftReport', () => {
  const mdOnlyItem: DriftItem = makeDriftItem({
    kind: 'md-only',
    ruleName: 'no-console',
    mdRuleId: 'forbidden-no-console-log-1',
    mdDescription: 'No console.log',
    mdSeverity: 'error',
    message: 'no-console is in CLAUDE.md but not in eslint config',
  });

  const eslintOnlyItem: DriftItem = makeDriftItem({
    kind: 'eslint-only',
    ruleName: 'sonarjs/no-identical-conditions',
    eslintSeverity: 'error',
    message: 'sonarjs/no-identical-conditions is in eslint config but not derived from CLAUDE.md',
  });

  const severityItem: DriftItem = makeDriftItem({
    kind: 'severity-mismatch',
    ruleName: 'prefer-const',
    mdSeverity: 'warn',
    eslintSeverity: 'error',
    message: 'prefer-const: CLAUDE.md says warn, eslint says error',
  });

  const configArgItem: DriftItem = makeDriftItem({
    kind: 'config-arg-mismatch',
    ruleName: 'max-lines',
    mdSeverity: 'error',
    eslintSeverity: 'error',
    mdOptions: [{ max: 300 }],
    eslintOptions: [{ max: 500 }],
    message: 'max-lines: CLAUDE.md says [{"max":300}], eslint says [{"max":500}]',
  });

  describe('text format', () => {
    it('reports no drift when items are empty', () => {
      const result = makeDriftResult([]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('No drift detected');
      expect(output).toContain('CLAUDE.md');
      expect(output).toContain('.eslintrc.json');
    });

    it('formats md-only items', () => {
      const result = makeDriftResult([mdOnlyItem]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('md-only');
      expect(output).toContain('no-console');
      expect(output).toContain('No console.log');
    });

    it('formats eslint-only items', () => {
      const result = makeDriftResult([eslintOnlyItem]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('eslint-only');
      expect(output).toContain('sonarjs/no-identical-conditions');
    });

    it('formats severity mismatches', () => {
      const result = makeDriftResult([severityItem]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('severity-mismatch');
      expect(output).toContain('prefer-const');
    });

    it('formats config-arg mismatches', () => {
      const result = makeDriftResult([configArgItem]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('config-arg-mismatch');
      expect(output).toContain('max-lines');
    });

    it('includes a summary line with counts', () => {
      const result = makeDriftResult([mdOnlyItem, eslintOnlyItem, severityItem, configArgItem]);
      const output = formatDriftReport(result, 'text');
      expect(output).toContain('1 md-only');
      expect(output).toContain('1 eslint-only');
      expect(output).toContain('1 severity-mismatch');
      expect(output).toContain('1 config-arg-mismatch');
    });
  });

  describe('json format', () => {
    it('produces valid JSON', () => {
      const result = makeDriftResult([mdOnlyItem]);
      const output = formatDriftReport(result, 'json');
      const parsed = JSON.parse(output);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.hasDrift).toBe(true);
    });

    it('includes all drift fields', () => {
      const result = makeDriftResult([configArgItem]);
      const output = formatDriftReport(result, 'json');
      const parsed = JSON.parse(output);
      expect(parsed.items[0].kind).toBe('config-arg-mismatch');
      expect(parsed.items[0].mdOptions).toEqual([{ max: 300 }]);
      expect(parsed.items[0].eslintOptions).toEqual([{ max: 500 }]);
    });
  });

  describe('markdown format', () => {
    it('reports no drift when items are empty', () => {
      const result = makeDriftResult([]);
      const output = formatDriftReport(result, 'markdown');
      expect(output).toContain('No drift detected');
    });

    it('formats a markdown table with drift items', () => {
      const result = makeDriftResult([mdOnlyItem, eslintOnlyItem]);
      const output = formatDriftReport(result, 'markdown');
      expect(output).toContain('md-only');
      expect(output).toContain('eslint-only');
      expect(output).toContain('no-console');
      expect(output).toContain('sonarjs/no-identical-conditions');
    });

    it('includes severity and options in markdown', () => {
      const result = makeDriftResult([configArgItem]);
      const output = formatDriftReport(result, 'markdown');
      expect(output).toContain('max-lines');
      expect(output).toContain('300');
      expect(output).toContain('500');
    });
  });
});