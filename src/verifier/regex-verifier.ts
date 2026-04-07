/**
 * Regex-based verifier for pattern matching on file contents.
 *
 * Reads files as plain text and runs line-by-line checks for
 * formatting rules: line length, indentation consistency, and
 * forbidden string patterns.
 */

import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
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
 * Check for @ts-ignore and @ts-nocheck directives in source code.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @returns Evidence array for violations
 */
function checkNoTsDirectives(
  content: string,
  filePath: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const pattern = /\/\/\s*@ts-(ignore|nocheck|expect-error)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(pattern);
    if (match) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: match[0],
        expected: 'no TypeScript suppression directives',
        context: lines[i]!,
      });
    }
  }

  return evidence;
}

/**
 * Check for .only() calls in test files.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param fileName - Base name of the file
 * @returns Evidence array for violations
 */
function checkNoTestOnly(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!fileName.endsWith('.test.ts') && !fileName.endsWith('.spec.ts') &&
      !fileName.endsWith('.test.js') && !fileName.endsWith('.spec.js')) {
    return [];
  }

  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const pattern = /\b(describe|it|test)\.only\b/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(pattern);
    if (match) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: match[0],
        expected: 'no .only() in test files',
        context: lines[i]!.trim(),
      });
    }
  }

  return evidence;
}

/**
 * Check for .skip() calls in test files.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param fileName - Base name of the file
 * @returns Evidence array for violations
 */
function checkNoTestSkip(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!fileName.endsWith('.test.ts') && !fileName.endsWith('.spec.ts') &&
      !fileName.endsWith('.test.js') && !fileName.endsWith('.spec.js')) {
    return [];
  }

  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const pattern = /\b(describe|it|test)\.skip\b/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(pattern);
    if (match) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: match[0],
        expected: 'no .skip() in test files',
        context: lines[i]!.trim(),
      });
    }
  }

  return evidence;
}

/**
 * Check for consistent quote style (single vs double).
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param expectedQuote - 'single' or 'double'
 * @returns Evidence array for violations
 */
function checkQuoteStyle(
  content: string,
  filePath: string,
  expectedQuote: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const forbidden = expectedQuote === 'single' ? /(?<!\\)"(?!.*\/\/)/ : /(?<!\\)'(?!.*\/\/)/;
  const label = expectedQuote === 'single' ? 'double quotes' : 'single quotes';
  const expected = expectedQuote === 'single' ? 'single quotes only' : 'double quotes only';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) {
      continue;
    }
    if (line.includes('import ') || line.includes('require(')) {
      if (forbidden.test(line)) {
        evidence.push({
          file: filePath,
          line: i + 1,
          found: label,
          expected,
          context: line.trim(),
        });
      }
    }
  }

  return evidence;
}

/**
 * Check for banned import patterns.
 *
 * @param content - File content as string
 * @param filePath - Relative file path for evidence
 * @param bannedPattern - The import pattern to ban
 * @returns Evidence array for violations
 */
function checkBannedImport(
  content: string,
  filePath: string,
  bannedPattern: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const regex = new RegExp(`(?:import|require).*['"]${bannedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i]!)) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: lines[i]!.trim(),
        expected: `import from "${bannedPattern}" is banned`,
        context: lines[i]!.trim(),
      });
    }
  }

  return evidence;
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
      const fileName = basename(fp);
      const patternType = rule.pattern.type;

      switch (patternType) {
        case 'max-line-length': {
          const maxLength = typeof rule.pattern.expected === 'string'
            ? parseInt(rule.pattern.expected, 10)
            : 120;
          allEvidence.push(...checkMaxLineLength(content, relPath, maxLength));
          break;
        }
        case 'no-ts-directives':
          allEvidence.push(...checkNoTsDirectives(content, relPath));
          break;
        case 'no-test-only':
          allEvidence.push(...checkNoTestOnly(content, relPath, fileName));
          break;
        case 'no-test-skip':
          allEvidence.push(...checkNoTestSkip(content, relPath, fileName));
          break;
        case 'quote-style': {
          const style = typeof rule.pattern.expected === 'string'
            ? rule.pattern.expected
            : 'single';
          allEvidence.push(...checkQuoteStyle(content, relPath, style));
          break;
        }
        case 'banned-import': {
          const bannedPkg = typeof rule.pattern.expected === 'string'
            ? rule.pattern.expected
            : '';
          if (bannedPkg) {
            allEvidence.push(...checkBannedImport(content, relPath, bannedPkg));
          }
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
