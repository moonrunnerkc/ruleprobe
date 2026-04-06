/**
 * Markdown report formatter.
 *
 * Renders an AdherenceReport as publishable markdown. For single
 * verify runs, produces a rule-by-rule report with code blocks
 * for evidence. For compare runs (multiple reports), produces a
 * comparison table matching the build guide format.
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

/**
 * Format a comparison of multiple AdherenceReports as markdown.
 *
 * Produces a table with one row per rule and one column per agent,
 * plus a score summary row. Matches the build guide comparison format.
 *
 * @param reports - Array of reports to compare
 * @param agentLabels - Display label for each report's agent
 * @returns Markdown string with comparison table
 */
export function formatComparisonMarkdown(
  reports: AdherenceReport[],
  agentLabels: string[],
): string {
  const lines: string[] = [];

  if (reports.length === 0) {
    return '# RuleProbe: No reports to compare';
  }

  const firstReport = reports[0]!;

  lines.push('# RuleProbe: Agent Instruction Adherence Comparison');
  lines.push('');
  lines.push(
    `Rules source: ${firstReport.ruleset.sourceFile} ` +
    `(${firstReport.ruleset.rules.length} rules extracted, ` +
    `${firstReport.ruleset.unparseable.length} unparseable)`,
  );
  lines.push(`Task: ${firstReport.run.taskTemplateId}`);
  lines.push(`Date: ${firstReport.run.timestamp.split('T')[0] ?? firstReport.run.timestamp}`);
  lines.push('');

  // Header row
  const headerCells = ['Rule', ...agentLabels];
  lines.push(`| ${headerCells.join(' | ')} |`);
  const dividerCells = ['------', ...agentLabels.map(() => ':------:')];
  lines.push(`| ${dividerCells.join(' | ')} |`);

  // Rule rows: use the first report's rules as the canonical list
  for (const rule of firstReport.ruleset.rules) {
    const cells: string[] = [rule.description || rule.id];

    for (const report of reports) {
      const result = report.results.find((r) => r.rule.id === rule.id);
      if (!result) {
        cells.push('-');
      } else {
        cells.push(result.passed ? 'PASS' : 'FAIL');
      }
    }

    lines.push(`| ${cells.join(' | ')} |`);
  }

  lines.push('');

  // Score summary table
  lines.push('| Agent | Score |');
  lines.push('|-------|-------|');
  for (let i = 0; i < reports.length; i++) {
    const report = reports[i]!;
    const label = agentLabels[i] ?? report.run.agent;
    const model = report.run.model;
    const score = Math.round(report.summary.adherenceScore);
    lines.push(`| ${label} (${model}) | ${score}% |`);
  }

  return lines.join('\n');
}
