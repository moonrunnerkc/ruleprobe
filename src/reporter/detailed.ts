/**
 * Detailed report formatter.
 *
 * Renders a full per-rule breakdown with code locations and
 * compliance scores. More verbose than text format, includes
 * compliance percentages per rule.
 */

import type {
  AdherenceReport,
  RuleCategory,
  CategoryScore,
} from '../types.js';

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
 * Shorten a file path relative to the output directory.
 */
function shortenPath(filePath: string, outputDir: string): string {
  if (filePath.startsWith(outputDir)) {
    const relative = filePath.slice(outputDir.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return filePath;
}

/**
 * Format an AdherenceReport as a detailed per-rule breakdown.
 *
 * Shows each rule with its compliance score, status, and all
 * evidence locations. Grouped by category.
 *
 * @param report - The adherence report to format
 * @returns Detailed breakdown string
 */
export function formatDetailed(report: AdherenceReport): string {
  const lines: string[] = [];
  const { run, summary, results } = report;

  lines.push('RuleProbe Detailed Report');
  lines.push(`Agent: ${run.agent} | Model: ${run.model} | Task: ${run.taskTemplateId}`);
  lines.push(`Date: ${run.timestamp}`);
  lines.push(`Score: ${Math.round(summary.adherenceScore)}%`);
  lines.push('');

  // Group results by category
  const byCategory = new Map<RuleCategory, typeof results>();
  for (const result of results) {
    const cat = result.rule.category;
    const existing = byCategory.get(cat) ?? [];
    existing.push(result);
    byCategory.set(cat, existing);
  }

  for (const cat of CATEGORY_ORDER) {
    const catResults = byCategory.get(cat);
    if (!catResults || catResults.length === 0) {
      continue;
    }

    const score: CategoryScore | undefined = summary.byCategory[cat];
    const catPct = score && score.total > 0
      ? Math.round((score.passed / score.total) * 100)
      : 0;

    lines.push(`[${cat}] (${catPct}%)`);

    for (const result of catResults) {
      const compliancePct = Math.round(result.compliance * 100);
      const status = result.passed ? 'PASS' : 'FAIL';
      lines.push(`  ${status} [${compliancePct}%] ${result.rule.id}: ${result.rule.description}`);

      if (!result.passed) {
        for (const ev of result.evidence) {
          const location = ev.line !== null
            ? `${shortenPath(ev.file, run.outputDir)}:${ev.line}`
            : shortenPath(ev.file, run.outputDir);
          lines.push(`    ${location}: ${ev.found}`);
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
