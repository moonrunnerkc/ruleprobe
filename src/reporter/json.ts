/**
 * JSON report formatter.
 *
 * Serializes an AdherenceReport to pretty-printed JSON.
 * Output must pass JSON.parse() validation.
 */

import type { AdherenceReport } from '../types.js';

/**
 * Format an AdherenceReport as pretty-printed JSON.
 *
 * Uses 2-space indentation for readability. The output is valid
 * JSON that can be parsed with JSON.parse().
 *
 * @param report - The adherence report to format
 * @returns JSON string with 2-space indentation
 */
export function formatJson(report: AdherenceReport): string {
  return JSON.stringify(report, null, 2);
}
