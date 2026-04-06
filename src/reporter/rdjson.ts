/**
 * Reviewdog rdjson format reporter.
 *
 * Transforms an AdherenceReport into reviewdog's Diagnostic format
 * (rdjson). Each failed rule becomes one or more diagnostics with
 * file, line, severity, and source metadata. Passing rules are
 * not included in the output.
 *
 * Spec: https://github.com/reviewdog/reviewdog/tree/master/proto/rdf
 */

import type { AdherenceReport, RuleResult, Evidence } from '../types.js';

/** Reviewdog diagnostic position. */
interface RdjsonPosition {
  line: number;
  column?: number;
}

/** Reviewdog diagnostic range (start only; end is optional). */
interface RdjsonRange {
  start: RdjsonPosition;
  end?: RdjsonPosition;
}

/** Reviewdog diagnostic location. */
interface RdjsonLocation {
  path: string;
  range?: RdjsonRange;
}

/** Reviewdog diagnostic code reference. */
interface RdjsonCode {
  value: string;
  url?: string;
}

/** Reviewdog diagnostic source. */
interface RdjsonSource {
  name: string;
  url: string;
}

/** A single reviewdog diagnostic entry. */
interface RdjsonDiagnostic {
  message: string;
  location: RdjsonLocation;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  source: RdjsonSource;
  code: RdjsonCode;
}

/** Top-level rdjson output structure. */
interface RdjsonOutput {
  source: RdjsonSource;
  diagnostics: RdjsonDiagnostic[];
}

const RULEPROBE_SOURCE: RdjsonSource = {
  name: 'ruleprobe',
  url: 'https://github.com/moonrunnerkc/ruleprobe',
};

/**
 * Map a rule severity to a reviewdog severity constant.
 */
function toRdjsonSeverity(severity: 'error' | 'warning'): 'ERROR' | 'WARNING' {
  return severity === 'error' ? 'ERROR' : 'WARNING';
}

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
 * Build a diagnostic from a single evidence entry within a failed rule result.
 */
function evidenceToDiagnostic(
  result: RuleResult,
  ev: Evidence,
  outputDir: string,
): RdjsonDiagnostic {
  const path = shortenPath(ev.file, outputDir);
  const message = `${result.rule.description}: ${ev.found}`;

  const location: RdjsonLocation = { path };
  if (ev.line !== null) {
    location.range = { start: { line: ev.line } };
  }

  return {
    message,
    location,
    severity: toRdjsonSeverity(result.rule.severity),
    source: RULEPROBE_SOURCE,
    code: { value: result.rule.id },
  };
}

/**
 * Format an AdherenceReport as reviewdog rdjson.
 *
 * Only failed rules appear in the diagnostics array. Each piece of
 * evidence on a failed rule produces a separate diagnostic so that
 * reviewdog can annotate individual lines.
 *
 * @param report - The adherence report to transform
 * @returns JSON string in rdjson format
 */
export function formatRdjson(report: AdherenceReport): string {
  const diagnostics: RdjsonDiagnostic[] = [];

  for (const result of report.results) {
    if (result.passed) {
      continue;
    }

    if (result.evidence.length === 0) {
      diagnostics.push({
        message: result.rule.description,
        location: { path: '.' },
        severity: toRdjsonSeverity(result.rule.severity),
        source: RULEPROBE_SOURCE,
        code: { value: result.rule.id },
      });
      continue;
    }

    for (const ev of result.evidence) {
      diagnostics.push(evidenceToDiagnostic(result, ev, report.run.outputDir));
    }
  }

  const output: RdjsonOutput = {
    source: RULEPROBE_SOURCE,
    diagnostics,
  };

  return JSON.stringify(output, null, 2);
}
