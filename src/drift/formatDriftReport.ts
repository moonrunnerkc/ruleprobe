/**
 * Drift report formatting.
 *
 * Produces text, JSON, or markdown output from a DriftResult.
 * Exit code convention: 0 = no drift, 1 = drift, 2 = execution error.
 */

import type { DriftResult, DriftFormat, DriftItem } from './types.js';

/** Count drift items by kind. */
function countByKind(items: DriftItem[]): Record<string, number> {
  const counts: Record<string, number> = {
    'md-only': 0,
    'eslint-only': 0,
    'severity-mismatch': 0,
    'config-arg-mismatch': 0,
  };
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return counts;
}

/** Format a single drift item as text. */
function formatItemText(item: DriftItem): string {
  const parts: string[] = [`  [${item.kind}] ${item.ruleName}`];
  if (item.mdRuleId) parts.push(`    rule: ${item.mdRuleId}`);
  if (item.mdDescription) parts.push(`    description: ${item.mdDescription}`);
  if (item.mdSeverity) parts.push(`    md severity: ${item.mdSeverity}`);
  if (item.eslintSeverity) parts.push(`    eslint severity: ${item.eslintSeverity}`);
  if (item.mdOptions && item.mdOptions.length > 0) {
    parts.push(`    md options: ${JSON.stringify(item.mdOptions)}`);
  }
  if (item.eslintOptions && item.eslintOptions.length > 0) {
    parts.push(`    eslint options: ${JSON.stringify(item.eslintOptions)}`);
  }
  return parts.join('\n');
}

/** Format a drift report as plain text. */
function formatText(result: DriftResult): string {
  if (!result.hasDrift) {
    return `No drift detected between ${result.mdFile} and ${result.eslintFile}`;
  }

  const counts = countByKind(result.items);
  const lines: string[] = [
    `Drift detected between ${result.mdFile} and ${result.eslintFile}`,
    '',
    'Summary:',
    `  ${counts['md-only']} md-only, ${counts['eslint-only']} eslint-only, ${counts['severity-mismatch']} severity-mismatch, ${counts['config-arg-mismatch']} config-arg-mismatch`,
    '',
    'Details:',
  ];

  for (const item of result.items) {
    lines.push(formatItemText(item));
  }

  return lines.join('\n');
}

/** Format a drift report as JSON. */
function formatJson(result: DriftResult): string {
  return JSON.stringify(result, null, 2);
}

/** Format a drift report as markdown. */
function formatMarkdown(result: DriftResult): string {
  if (!result.hasDrift) {
    return `## No drift detected\n\nNo drift between \`${result.mdFile}\` and \`${result.eslintFile}\`.`;
  }

  const lines: string[] = [
    '## Drift detected',
    '',
    `Between \`${result.mdFile}\` and \`${result.eslintFile}\`:`,
    '',
    '| Kind | Rule | MD Severity | ESLint Severity | MD Options | ESLint Options |',
    '|------|------|-------------|-----------------|------------|----------------|',
  ];

  for (const item of result.items) {
    const mdOpts = item.mdOptions && item.mdOptions.length > 0 ? JSON.stringify(item.mdOptions) : '-';
    const eslintOpts = item.eslintOptions && item.eslintOptions.length > 0 ? JSON.stringify(item.eslintOptions) : '-';
    lines.push(
      `| ${item.kind} | \`${item.ruleName}\` | ${item.mdSeverity ?? '-'} | ${item.eslintSeverity ?? '-'} | ${mdOpts} | ${eslintOpts} |`,
    );
  }

  return lines.join('\n');
}

/**
 * Format a DriftResult as text, JSON, or markdown.
 *
 * @param result - The drift comparison result
 * @param format - Output format: 'text' (default), 'json', or 'markdown'
 * @returns Formatted string ready for output
 */
export function formatDriftReport(result: DriftResult, format: DriftFormat = 'text'): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'markdown':
      return formatMarkdown(result);
    default:
      return formatText(result);
  }
}