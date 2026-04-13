/**
 * Summary report formatter.
 *
 * Produces a compact table showing per-category compliance
 * with an overall score. Designed as the default CLI output.
 */

import type { AdherenceReport, RuleCategory, CategoryScore } from '../types.js';

/** Category display order. */
const CATEGORY_ORDER: RuleCategory[] = [
  'naming',
  'forbidden-pattern',
  'structure',
  'import-pattern',
  'test-requirement',
  'error-handling',
  'type-safety',
  'code-style',
  'dependency',
  'preference',
  'file-structure',
  'tooling',
  'testing',
];

/**
 * Format an AdherenceReport as a compact summary table.
 *
 * Shows one row per category with non-zero rules, plus an overall score line.
 * Designed for quick terminal consumption.
 *
 * @param report - The adherence report to format
 * @returns Compact summary string
 */
export function formatSummary(report: AdherenceReport): string {
  const lines: string[] = [];
  const { summary } = report;

  lines.push('RuleProbe Summary');
  lines.push('='.repeat(50));
  lines.push('');

  const labelWidth = 22;
  const header = 'Category'.padEnd(labelWidth) + 'Pass  Total  Score';
  lines.push(header);
  lines.push('-'.repeat(50));

  for (const cat of CATEGORY_ORDER) {
    const score: CategoryScore | undefined = summary.byCategory[cat];
    if (!score || score.total === 0) {
      continue;
    }
    const pct = Math.round((score.passed / score.total) * 100);
    const label = cat.padEnd(labelWidth);
    const passCol = String(score.passed).padStart(4);
    const totalCol = String(score.total).padStart(5);
    const pctCol = `${pct}%`.padStart(6);
    lines.push(`${label}${passCol}${totalCol}${pctCol}`);
  }

  lines.push('-'.repeat(50));
  const overallLabel = 'OVERALL'.padEnd(labelWidth);
  const overallPass = String(summary.passed).padStart(4);
  const overallTotal = String(summary.totalRules).padStart(5);
  const overallPct = `${Math.round(summary.adherenceScore)}%`.padStart(6);
  lines.push(`${overallLabel}${overallPass}${overallTotal}${overallPct}`);

  return lines.join('\n');
}
