/**
 * Local audit logging for semantic analysis.
 *
 * Writes a timestamped log of every API call (payload sent, response
 * received, token cost) to .ruleprobe/semantic-log/. The --semantic-log
 * flag also prints this to stdout.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SemanticPipelineResult } from './index.js';

/** Directory name for audit logs within the project. */
const AUDIT_LOG_DIR = '.ruleprobe/semantic-log';

/**
 * Write an audit log entry for a semantic analysis run.
 *
 * Creates the log directory if it does not exist. The log file
 * is named with an ISO timestamp for chronological ordering.
 *
 * @param projectDir - Root directory of the analyzed project
 * @param result - The semantic pipeline result to log
 * @returns Absolute path to the written log file
 */
export function writeAuditLog(
  projectDir: string,
  result: SemanticPipelineResult,
): string {
  const logDir = join(projectDir, AUDIT_LOG_DIR);
  mkdirSync(logDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = join(logDir, `${timestamp}.json`);

  const entry = {
    timestamp: new Date().toISOString(),
    performed: result.performed,
    skipReason: result.skipReason,
    verdictsCount: result.verdicts.length,
    sentPayload: result.sentPayload
      ? {
          fileVectorCount: Object.keys(result.sentPayload.fileVectors).length,
          rulesCount: result.sentPayload.rules.length,
          extractionHash: result.sentPayload.extractionHash,
        }
      : null,
    report: result.report
      ? {
          rulesAnalyzed: result.report.rulesAnalyzed,
          fastPathResolutions: result.report.fastPathResolutions,
          llmResolutions: result.report.llmResolutions,
          totalTokenCost: result.report.totalTokenCost,
          profileCacheHit: result.report.profileCacheHit,
        }
      : null,
  };

  writeFileSync(logFile, JSON.stringify(entry, null, 2), 'utf-8');
  return logFile;
}

/**
 * Format a semantic pipeline result as a human-readable audit log string.
 *
 * @param result - The semantic pipeline result to format
 * @returns Formatted audit log text
 */
export function formatAuditLog(result: SemanticPipelineResult): string {
  const lines: string[] = [];
  lines.push('--- Semantic Analysis Audit Log ---');
  lines.push(`Performed: ${result.performed}`);

  if (result.skipReason) {
    lines.push(`Skip reason: ${result.skipReason}`);
  }

  if (result.sentPayload) {
    const vectorCount = Object.keys(result.sentPayload.fileVectors).length;
    lines.push(`Files scanned: ${vectorCount}`);
    lines.push(`Rules sent: ${result.sentPayload.rules.length}`);
    lines.push(`Extraction hash: ${result.sentPayload.extractionHash}`);
  }

  lines.push(`Verdicts received: ${result.verdicts.length}`);

  if (result.report) {
    lines.push(`Fast-path resolutions: ${result.report.fastPathResolutions}`);
    lines.push(`LLM resolutions: ${result.report.llmResolutions}`);
    lines.push(`Total token cost: ${result.report.totalTokenCost}`);
    lines.push(`Profile cache hit: ${result.report.profileCacheHit}`);
  }

  lines.push('--- End Audit Log ---');
  return lines.join('\n');
}
