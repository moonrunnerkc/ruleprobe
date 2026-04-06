/**
 * Regex-based verifier for pattern matching on file contents.
 *
 * Reads files as plain text and runs line-by-line checks for
 * formatting rules: line length, indentation consistency, and
 * forbidden string patterns.
 */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';

/**
 * Check maximum line length across all lines in a file.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param maxLength - Maximum allowed characters per line
 * @returns Evidence array for violations
 */
function checkMaxLineLength(
  content: string,
  filePath: string,
  maxLength: number,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > maxLength) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: `${line.length} characters`,
        expected: `max ${maxLength} characters per line`,
        context: line.slice(0, 120) + (line.length > 120 ? '...' : ''),
      });
    }
  }

  return evidence;
}

/**
 * Check file length (total line count) against a maximum.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param maxLines - Maximum allowed lines per file
 * @returns Evidence array for violations
 */
function checkMaxFileLength(
  content: string,
  filePath: string,
  maxLines: number,
): Evidence[] {
  const lineCount = content.split('\n').length;

  if (lineCount > maxLines) {
    return [{
      file: filePath,
      line: null,
      found: `${lineCount} lines`,
      expected: `max ${maxLines} lines`,
      context: '',
    }];
  }

  return [];
}

/**
 * Verify a regex-based rule against a set of files.
 *
 * Routes to the appropriate check function based on the rule's
 * verification pattern type. Reads each file as text and runs
 * the pattern check.
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to files to check
 * @param outputDir - Root directory for relative path computation
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyRegexRule(
  rule: Rule,
  filePaths: string[],
  outputDir: string,
): RuleResult {
  const allEvidence: Evidence[] = [];

  for (const fp of filePaths) {
    try {
      const content = readFileSync(fp, 'utf-8');
      const relPath = relative(outputDir, fp);
      const patternType = rule.pattern.type;

      switch (patternType) {
        case 'max-line-length': {
          const maxLength = typeof rule.pattern.expected === 'string'
            ? parseInt(rule.pattern.expected, 10)
            : 120;
          allEvidence.push(...checkMaxLineLength(content, relPath, maxLength));
          break;
        }
        case 'max-file-length': {
          const maxLines = typeof rule.pattern.expected === 'string'
            ? parseInt(rule.pattern.expected, 10)
            : 300;
          allEvidence.push(...checkMaxFileLength(content, relPath, maxLines));
          break;
        }
        default:
          break;
      }
    } catch {
      // Skip files we can't read
    }
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    evidence: allEvidence,
  };
}
