/**
 * Report format router.
 *
 * Routes to the correct formatter based on the format string.
 * Single entry point for all report formatting.
 */

import type { AdherenceReport, ReportFormat } from '../types.js';
import { formatTextPlain } from './text.js';
import { formatJson } from './json.js';
import { formatMarkdown } from './markdown.js';
import { formatRdjson } from './rdjson.js';
import { formatSummary } from './summary.js';
import { formatDetailed } from './detailed.js';
import { formatCi } from './ci.js';

export { formatTextPlain, formatParseText } from './text.js';
export { formatJson } from './json.js';
export { formatMarkdown, formatComparisonMarkdown } from './markdown.js';
export { formatRdjson } from './rdjson.js';
export { formatSummary } from './summary.js';
export { formatDetailed } from './detailed.js';
export { formatCi } from './ci.js';

/**
 * Format an AdherenceReport in the specified output format.
 *
 * @param report - The adherence report to format
 * @param format - Output format: "text", "json", "markdown", "rdjson", "summary", "detailed", or "ci"
 * @returns Formatted string
 * @throws Error if format is not recognized
 */
export function formatReport(
  report: AdherenceReport,
  format: ReportFormat,
): string {
  switch (format) {
    case 'text':
      return formatTextPlain(report);
    case 'json':
      return formatJson(report);
    case 'markdown':
      return formatMarkdown(report);
    case 'rdjson':
      return formatRdjson(report);
    case 'summary':
      return formatSummary(report);
    case 'detailed':
      return formatDetailed(report);
    case 'ci':
      return formatCi(report);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unknown report format: ${String(exhaustive)}`);
    }
  }
}
