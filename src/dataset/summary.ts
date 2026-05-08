/**
 * Statistics and summary generation for Phase 0 data collection.
 *
 * Pure functions for computing medians, percentiles, histograms,
 * clustering unparseable patterns, and rendering the go/no-go SUMMARY.md.
 */

import { parseInstructionContent, detectFileType } from '../parsers/index.js';
import type { RuleSet, RuleCategory } from '../types.js';

export interface PerFileResult {
  repoUrl: string;
  repoStars: number;
  filePath: string;
  sourceType: string;
  parseableRuleCount: number;
  categoryBreakdown: Partial<Record<RuleCategory, number>>;
  unparseableLines: string[];
  parseError: string | null;
}

/** Parse instruction file content and extract structured results. */
export function parseFileContent(content: string, filePath: string): PerFileResult {
  try {
    const ruleSet: RuleSet = parseInstructionContent(content, filePath);
    const sourceType = ruleSet.sourceType;
    const parseableRuleCount = ruleSet.rules.length;

    const categoryBreakdown: Partial<Record<RuleCategory, number>> = {};
    for (const rule of ruleSet.rules) {
      categoryBreakdown[rule.category] = (categoryBreakdown[rule.category] ?? 0) + 1;
    }

    const unparseableLines = ruleSet.unparseable.filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('```');
    });

    return {
      repoUrl: '',
      repoStars: 0,
      filePath,
      sourceType,
      parseableRuleCount,
      categoryBreakdown,
      unparseableLines,
      parseError: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      repoUrl: '',
      repoStars: 0,
      filePath,
      sourceType: detectFileType(filePath),
      parseableRuleCount: 0,
      categoryBreakdown: {},
      unparseableLines: [],
      parseError: message,
    };
  }
}

/** Compute the median of a numeric array. Returns 0 for empty input. */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const left = sorted[mid - 1] ?? 0;
  const right = sorted[mid] ?? 0;
  return sorted.length % 2 !== 0 ? right : (left + right) / 2;
}

/** Compute a percentile value from a numeric array. Returns 0 for empty input. */
export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/** Render a text histogram of rule counts per file. */
export function buildHistogram(values: number[]): string {
  if (values.length === 0) return 'No data';

  const buckets = new Map<string, number>([
    ['0', 0],
    ['1-4', 0],
    ['5-9', 0],
    ['10-19', 0],
    ['20-49', 0],
    ['50+', 0],
  ]);

  for (const v of values) {
    if (v === 0) buckets.set('0', (buckets.get('0') ?? 0) + 1);
    else if (v < 5) buckets.set('1-4', (buckets.get('1-4') ?? 0) + 1);
    else if (v < 10) buckets.set('5-9', (buckets.get('5-9') ?? 0) + 1);
    else if (v < 20) buckets.set('10-19', (buckets.get('10-19') ?? 0) + 1);
    else if (v < 50) buckets.set('20-49', (buckets.get('20-49') ?? 0) + 1);
    else buckets.set('50+', (buckets.get('50+') ?? 0) + 1);
  }

  const maxCount = Math.max(...buckets.values());
  const lines: string[] = [];
  for (const [label, count] of buckets) {
    const barLength = maxCount > 0 ? Math.round((count / maxCount) * 40) : 0;
    const bar = '#'.repeat(barLength);
    lines.push(`  ${label.padStart(5)} | ${bar} ${count}`);
  }
  return lines.join('\n');
}

/** Cluster unparseable lines by normalized form, sorted by frequency. */
export function clusterUnparseable(lines: string[]): Array<{ pattern: string; count: number }> {
  const normalized = new Map<string, { original: string; count: number }>();

  for (const line of lines) {
    const key = line
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^[-*#>\s]+/, '')
      .trim();
    if (key.length < 3) continue;

    const existing = normalized.get(key);
    if (existing) {
      existing.count++;
    } else {
      normalized.set(key, { original: line, count: 1 });
    }
  }

  return [...normalized.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, val]) => ({ pattern: key.slice(0, 120), count: val.count }));
}

/** Generate the Phase 0 SUMMARY.md content from per-file results. */
export function generateSummary(results: PerFileResult[]): string {
  const ruleCounts = results.map((r) => r.parseableRuleCount);
  const median = computeMedian(ruleCounts);
  const p75 = computePercentile(ruleCounts, 75);
  const p90 = computePercentile(ruleCounts, 90);
  const totalRules = ruleCounts.reduce((a, b) => a + b, 0);
  const totalUnparseable = results.reduce((sum, r) => sum + r.unparseableLines.length, 0);
  const filesWithRules = ruleCounts.filter((c) => c > 0).length;
  const totalFiles = results.length;

  const categoryTotals: Record<string, number> = {};
  for (const r of results) {
    for (const [cat, count] of Object.entries(r.categoryBreakdown)) {
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + count;
    }
  }
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const allUnparseable = results.flatMap((r) => r.unparseableLines);
  const topUnparseable = clusterUnparseable(allUnparseable).slice(0, 10);

  const parseErrors = results.filter((r) => r.parseError !== null).length;

  const goDecision = median >= 5 && p75 >= 10;
  const verdict = goDecision ? 'GO' : 'NO-GO';

  const sourceTypes: Record<string, number> = {};
  for (const r of results) {
    sourceTypes[r.sourceType] = (sourceTypes[r.sourceType] ?? 0) + 1;
  }

  const lines: string[] = [
    '# Phase 0 Summary',
    '',
    `**Verdict: ${verdict}**`,
    '',
    `Median parseable rules per file: **${median}** (threshold: >= 5)`,
    `75th percentile: **${p75}** (threshold: >= 10)`,
    `90th percentile: ${p90}`,
    '',
    goDecision
      ? 'The dataset contains enough mechanically-mappable rules to justify the translator.'
      : 'The dataset does not contain enough mechanically-mappable rules. The numbers are published as-is to seed Phase 5 visibility.',
    '',
    '## Dataset Overview',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Repos analyzed | ${totalFiles} |`,
    `| Files with >= 1 rule | ${filesWithRules} |`,
    `| Total rules extracted | ${totalRules} |`,
    `| Total unparseable lines | ${totalUnparseable} |`,
    `| Files with parse errors | ${parseErrors} |`,
    '',
    '## Source Types',
    '',
    ...Object.entries(sourceTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `- ${type}: ${count}`),
    '',
    '## Rule Count Distribution',
    '',
    buildHistogram(ruleCounts),
    '',
    '## Top 10 Rule Categories',
    '',
    '| Category | Count |',
    '|----------|-------|',
    ...topCategories.map(([cat, count]) => `| ${cat} | ${count} |`),
    '',
    '## Top 10 Unparseable Patterns',
    '',
    '| Pattern | Occurrences |',
    '|---------|-------------|',
    ...topUnparseable.map(({ pattern, count }) => `| ${pattern} | ${count} |`),
    '',
    '## Decision Criteria',
    '',
    '- **Median >= 5 rules per file**: measurement threshold for "enough signal"',
    '- **Top quartile (P75) >= 10 rules per file**: measurement threshold for "enough depth"',
    '- Both must pass for GO. Either failing triggers NO-GO.',
  ];

  return lines.join('\n');
}