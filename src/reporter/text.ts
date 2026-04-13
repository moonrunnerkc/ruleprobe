/**
 * Text report formatter.
 *
 * Renders an AdherenceReport as terminal-friendly text with
 * chalk coloring for pass/fail indicators. Matches the format
 * from the build guide: header, rule results with evidence,
 * and category summary at the bottom.
 */

import chalk from 'chalk';
import type { AdherenceReport, RuleCategory, CategoryScore } from '../types.js';

/** Category display names in a stable order. */
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
 * Format a relative file path for display, stripping the output
 * directory prefix if present.
 */
function shortenPath(filePath: string, outputDir: string): string {
  if (filePath.startsWith(outputDir)) {
    const relative = filePath.slice(outputDir.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return filePath;
}

/**
 * Format an AdherenceReport as colored terminal text.
 *
 * @param report - The adherence report to format
 * @returns Formatted text string
 */
export function formatText(report: AdherenceReport): string {
  const lines: string[] = [];
  const { run, summary, results } = report;

  // Header
  lines.push('RuleProbe Adherence Report');
  lines.push(
    `Agent: ${run.agent} | Model: ${run.model} | Task: ${run.taskTemplateId}`,
  );
  lines.push(`Date: ${run.timestamp}`);
  lines.push('');

  // Summary line
  const scoreColor = summary.adherenceScore >= 80
    ? chalk.green
    : summary.adherenceScore >= 50
      ? chalk.yellow
      : chalk.red;

  lines.push(
    `Rules: ${summary.totalRules} total | ` +
    `${summary.passed} passed | ` +
    `${summary.failed} failed | ` +
    `Score: ${scoreColor(`${Math.round(summary.adherenceScore)}%`)}`,
  );
  lines.push('');

  // Individual rule results
  for (const result of results) {
    const ruleId = `${result.rule.category}/${result.rule.id}`;

    if (result.passed) {
      lines.push(`${chalk.green('PASS')}  ${ruleId}`);
    } else {
      lines.push(`${chalk.red('FAIL')}  ${ruleId}`);
      for (const ev of result.evidence) {
        const location = ev.line !== null
          ? `${shortenPath(ev.file, run.outputDir)}:${ev.line}`
          : shortenPath(ev.file, run.outputDir);
        lines.push(`      ${location} - found: ${ev.found}`);
      }
    }
  }

  // Category summary
  lines.push('');
  lines.push('By Category:');
  for (const cat of CATEGORY_ORDER) {
    const score: CategoryScore | undefined = summary.byCategory[cat];
    if (!score || score.total === 0) {
      continue;
    }
    const pct = Math.round((score.passed / score.total) * 100);
    const label = `${cat}:`.padEnd(20);
    const counts = `${score.passed}/${score.total} (${pct}%)`;
    lines.push(`  ${label}${counts}`);
  }

  // Summary statistics line at end
  lines.push('');
  lines.push(
    `Summary: ${summary.totalRules} checked | ` +
    `${summary.passed} passed | ` +
    `${summary.failed} failed | ` +
    `${summary.skipped} skipped`,
  );

  return lines.join('\n');
}

/**
 * Format an AdherenceReport as plain text without ANSI color codes.
 *
 * Used when output is piped to a file or when chalk is not supported.
 *
 * @param report - The adherence report to format
 * @returns Plain text string without color codes
 */
export function formatTextPlain(report: AdherenceReport): string {
  const lines: string[] = [];
  const { run, summary, results } = report;

  lines.push('RuleProbe Adherence Report');
  lines.push(
    `Agent: ${run.agent} | Model: ${run.model} | Task: ${run.taskTemplateId}`,
  );
  lines.push(`Date: ${run.timestamp}`);
  lines.push('');

  lines.push(
    `Rules: ${summary.totalRules} total | ` +
    `${summary.passed} passed | ` +
    `${summary.failed} failed | ` +
    `Score: ${Math.round(summary.adherenceScore)}%`,
  );
  lines.push('');

  for (const result of results) {
    const ruleId = `${result.rule.category}/${result.rule.id}`;

    if (result.passed) {
      lines.push(`PASS  ${ruleId}`);
    } else {
      lines.push(`FAIL  ${ruleId}`);
      for (const ev of result.evidence) {
        const location = ev.line !== null
          ? `${shortenPath(ev.file, run.outputDir)}:${ev.line}`
          : shortenPath(ev.file, run.outputDir);
        lines.push(`      ${location} - found: ${ev.found}`);
      }
    }
  }

  lines.push('');
  lines.push('By Category:');
  for (const cat of CATEGORY_ORDER) {
    const score: CategoryScore | undefined = summary.byCategory[cat];
    if (!score || score.total === 0) {
      continue;
    }
    const pct = Math.round((score.passed / score.total) * 100);
    const label = `${cat}:`.padEnd(20);
    const counts = `${score.passed}/${score.total} (${pct}%)`;
    lines.push(`  ${label}${counts}`);
  }

  lines.push('');
  lines.push(
    `Summary: ${summary.totalRules} checked | ` +
    `${summary.passed} passed | ` +
    `${summary.failed} failed | ` +
    `${summary.skipped} skipped`,
  );

  return lines.join('\n');
}

/**
 * Format just the parse output (rules extracted from an instruction file).
 *
 * @param rules - Extracted rules from the instruction file
 * @param unparseable - Lines that could not be extracted
 * @param showUnparseable - Whether to include unparseable lines
 * @returns Formatted text string
 */
export function formatParseText(
  rules: AdherenceReport['ruleset']['rules'],
  unparseable: string[],
  showUnparseable: boolean,
): string {
  const lines: string[] = [];

  lines.push(`Extracted ${rules.length} rules:\n`);

  for (const rule of rules) {
    lines.push(`  ${rule.id}`);
    lines.push(`    Category: ${rule.category}`);
    lines.push(`    Verifier: ${rule.verifier}`);
    lines.push(`    Pattern:  ${rule.pattern.type} (${rule.pattern.target})`);
    lines.push(`    Source:    "${rule.source}"`);
    lines.push('');
  }

  if (showUnparseable && unparseable.length > 0) {
    lines.push(`\nUnparseable lines (${unparseable.length}):\n`);
    for (const line of unparseable) {
      lines.push(`  - ${line}`);
    }
  }

  return lines.join('\n');
}
