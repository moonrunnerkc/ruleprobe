/**
 * Report format router.
 *
 * Routes to the correct formatter based on the format string.
 * Single entry point for all report formatting.
 */

import type { AdherenceReport } from '../types.js';
import { formatText, formatTextPlain } from './text.js';
import { formatJson } from './json.js';
import { formatMarkdown } from './markdown.js';

export { formatText, formatTextPlain, formatParseText } from './text.js';
export { formatJson } from './json.js';
export { formatMarkdown, formatComparisonMarkdown } from './markdown.js';

/**
 * Format an AdherenceReport in the specified output format.
 *
 * @param report - The adherence report to format
 * @param format - Output format: "text", "json", or "markdown"
 * @returns Formatted string
 * @throws Error if format is not recognized
 */
export function formatReport(
  report: AdherenceReport,
  format: 'text' | 'json' | 'markdown',
): string {
  switch (format) {
    case 'text':
      return formatTextPlain(report);
    case 'json':
      return formatJson(report);
    case 'markdown':
      return formatMarkdown(report);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unknown report format: ${String(exhaustive)}`);
    }
  }
}
