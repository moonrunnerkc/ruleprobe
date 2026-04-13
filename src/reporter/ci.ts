/**
 * CI report formatter.
 *
 * Produces minimal output suitable for CI pipelines. Reports the
 * overall pass/fail status based on a configurable threshold,
 * plus GitHub Actions annotation-compatible lines for failures.
 */

import type { AdherenceReport } from '../types.js';
import { DEFAULT_COMPLIANCE_THRESHOLD } from '../types.js';

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
 * Format an AdherenceReport for CI consumption.
 *
 * Outputs the overall score, threshold, and pass/fail determination.
 * Failed rules produce GitHub Actions annotation-formatted lines.
 *
 * @param report - The adherence report to format
 * @param threshold - Compliance threshold for pass/fail (default: 0.8)
 * @returns CI-friendly output string
 */
export function formatCi(
  report: AdherenceReport,
  threshold: number = DEFAULT_COMPLIANCE_THRESHOLD,
): string {
  const lines: string[] = [];
  const score = report.summary.adherenceScore;
  const passed = score >= threshold * 100;

  lines.push(`score=${Math.round(score)}%`);
  lines.push(`threshold=${Math.round(threshold * 100)}%`);
  lines.push(`status=${passed ? 'pass' : 'fail'}`);
  lines.push(`rules=${report.summary.totalRules}`);
  lines.push(`passed=${report.summary.passed}`);
  lines.push(`failed=${report.summary.failed}`);

  // GitHub Actions annotations for failures
  const failures = report.results.filter((r) => !r.passed);
  for (const result of failures) {
    for (const ev of result.evidence) {
      const path = shortenPath(ev.file, report.run.outputDir);
      if (ev.line !== null) {
        lines.push(`::error file=${path},line=${ev.line}::${result.rule.description}: ${ev.found}`);
      } else {
        lines.push(`::error file=${path}::${result.rule.description}: ${ev.found}`);
      }
    }
  }

  return lines.join('\n');
}
