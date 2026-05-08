/**
 * Markdown report formatter.
 *
 * Renders an AdherenceReport as publishable markdown with
 * rule-by-rule results and a category summary table.
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
  'error-handling',
  'type-safety',
  'code-style',
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
 * Format a single AdherenceReport as markdown.
 *
 * @param report - The adherence report to format
 * @returns Markdown string
 */
export function formatMarkdown(report: AdherenceReport): string {
  const lines: string[] = [];
  const { run, summary, results } = report;

  lines.push('# RuleProbe Adherence Report');
  lines.push('');
  lines.push(
    `**Agent:** ${run.agent} | **Model:** ${run.model} | **Task:** ${run.taskTemplateId}`,
  );
  lines.push(`**Date:** ${run.timestamp}`);
  lines.push('');

  const scoreStr = `${Math.round(summary.adherenceScore)}%`;
  lines.push(
    `**Rules:** ${summary.totalRules} total | ` +
    `${summary.passed} passed | ` +
    `${summary.failed} failed | ` +
    `**Score: ${scoreStr}**`,
  );
  lines.push('');

  // Rule results table
  lines.push('## Results');
  lines.push('');

  for (const result of results) {
    const ruleId = `${result.rule.category}/${result.rule.id}`;
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? ':white_check_mark:' : ':x:';

    lines.push(`### ${icon} ${status}: ${ruleId}`);
    lines.push('');

    if (!result.passed && result.evidence.length > 0) {
      lines.push('```');
      for (const ev of result.evidence) {
        const location = ev.line !== null
          ? `${shortenPath(ev.file, run.outputDir)}:${ev.line}`
          : shortenPath(ev.file, run.outputDir);
        lines.push(`${location} - found: ${ev.found}`);
      }
      lines.push('```');
      lines.push('');
    }
  }

  // Category summary
  lines.push('## Category Summary');
  lines.push('');
  lines.push('| Category | Passed | Total | Score |');
  lines.push('|----------|--------|-------|-------|');
  for (const cat of CATEGORY_ORDER) {
    const score: CategoryScore | undefined = summary.byCategory[cat];
    if (!score || score.total === 0) {
      continue;
    }
    const pct = Math.round((score.passed / score.total) * 100);
    lines.push(`| ${cat} | ${score.passed} | ${score.total} | ${pct}% |`);
  }

  return lines.join('\n');
}
