/**
 * Format drift detection results as a GitHub PR comment.
 *
 * Produces markdown with a summary line, a table of drift items,
 * and the dedup marker (<!-- ruleprobe-drift -->) used to find
 * and update existing comments instead of posting duplicates.
 */

import type { DriftItem, DriftResult } from '../drift/types.js';

/** Hidden marker used to find and update existing RuleProbe drift comments. */
const DRIFT_MARKER = '<!-- ruleprobe-drift -->';

/** Threshold for wrapping content in a collapsible details block. */
const COLLAPSE_THRESHOLD = 10;

/**
 * Format a drift count as a summary line.
 *
 * @param count - Number of drift issues detected
 * @returns A human-readable summary string
 */
export function formatDriftSummary(count: number): string {
  if (count === 0) return 'No drift detected';
  if (count === 1) return '1 drift issue detected';
  return `${count} drift issues detected`;
}

/** Format a single drift item as a table row. */
function formatItemRow(item: DriftItem): string {
  const mdSev = item.mdSeverity ?? '-';
  const eslintSev = item.eslintSeverity ?? '-';
  const mdOpts = item.mdOptions && item.mdOptions.length > 0
    ? JSON.stringify(item.mdOptions)
    : '-';
  const eslintOpts = item.eslintOptions && item.eslintOptions.length > 0
    ? JSON.stringify(item.eslintOptions)
    : '-';
  return `| ${item.kind} | \`${item.ruleName}\` | ${mdSev} | ${eslintSev} | ${mdOpts} | ${eslintOpts} |`;
}

/** Format drift items as a markdown table. */
function formatDriftTable(items: DriftItem[]): string {
  const header = '| Kind | Rule | MD Severity | ESLint Severity | MD Options | ESLint Options |';
  const separator = '|------|------|-------------|-----------------|------------|----------------|';
  const rows = items.map(formatItemRow);
  return [header, separator, ...rows].join('\n');
}

/**
 * Format a drift result as a GitHub PR comment body.
 *
 * Uses the ruleprobe-drift marker for deduplication. Short drift
 * lists are shown inline; longer ones are wrapped in a collapsible
 * details block.
 *
 * @param result - The drift comparison result
 * @returns A formatted markdown string ready to post as a PR comment
 */
export function formatDriftComment(result: DriftResult): string {
  if (!result.hasDrift) {
    return [
      DRIFT_MARKER,
      '## RuleProbe: No drift detected',
      '',
      `No drift between \`${result.mdFile}\` and \`${result.eslintFile}\`.`,
    ].join('\n');
  }

  const summary = formatDriftSummary(result.items.length);
  const table = formatDriftTable(result.items);

  if (result.items.length >= COLLAPSE_THRESHOLD) {
    return [
      DRIFT_MARKER,
      `## RuleProbe: ${summary}`,
      '',
      `Between \`${result.mdFile}\` and \`${result.eslintFile}\`:`,
      '',
      '<details>',
      `<summary>${summary}</summary>`,
      '',
      table,
      '',
      '</details>',
    ].join('\n');
  }

  return [
    DRIFT_MARKER,
    `## RuleProbe: ${summary}`,
    '',
    `Between \`${result.mdFile}\` and \`${result.eslintFile}\`:`,
    '',
    table,
  ].join('\n');
}