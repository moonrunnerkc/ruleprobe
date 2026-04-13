/**
 * Regex-based check functions for file content analysis.
 *
 * Contains all individual check functions used by the regex verifier.
 * Each function takes file content and returns evidence arrays.
 */

import type { Evidence } from '../types.js';

/**
 * Check maximum line length across all lines in a file.
 */
export function checkMaxLineLength(
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
 */
export function checkNoTsDirectives(
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
 */
export function checkNoTestOnly(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!isTestFile(fileName)) {
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
 */
export function checkNoTestSkip(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!isTestFile(fileName)) {
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
 */
export function checkQuoteStyle(
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
 */
export function checkBannedImport(
  content: string,
  filePath: string,
  bannedPattern: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const regex = new RegExp(
    `(?:import|require).*['"]${bannedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i',
  );

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
 * Check for TODO, FIXME, HACK, and XXX comments.
 */
export function checkNoTodoComments(
  content: string,
  filePath: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const pattern = /\b(TODO|FIXME|HACK|XXX)\b/;

  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]!);
    if (match) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: `${match[1]} comment`,
        expected: 'no TODO/FIXME/HACK/XXX comments',
        context: lines[i]!.trim(),
      });
    }
  }

  return evidence;
}

/**
 * Check for consistent semicolon usage (present or absent).
 *
 * In "always" mode, flags lines that look like statements but
 * lack a trailing semicolon. In "never" mode, flags lines with
 * trailing semicolons that should rely on ASI.
 */
export function checkConsistentSemicolons(
  content: string,
  filePath: string,
  style: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const requireSemicolons = style === 'always';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // Skip empty lines, comments, lines opening blocks
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }
    if (line.endsWith('{') || line.endsWith('(') || line.endsWith(',')) {
      continue;
    }
    // Skip lines that are just closing braces/brackets
    if (/^[}\])]$/.test(line)) {
      continue;
    }
    // Skip decorators, type-only constructs without values
    if (line.startsWith('@') || line.startsWith('//')) {
      continue;
    }

    // Identify statement-like lines: end with a value-like token
    const isStatementLike = /[)}\]'"0-9a-z_]$/i.test(line);
    if (!isStatementLike) {
      continue;
    }

    const hasSemicolon = line.endsWith(';');
    if (requireSemicolons && !hasSemicolon) {
      evidence.push({
        file: filePath, line: i + 1,
        found: 'missing semicolon',
        expected: 'semicolons required',
        context: line,
      });
    } else if (!requireSemicolons && hasSemicolon) {
      evidence.push({
        file: filePath, line: i + 1,
        found: 'unexpected semicolon',
        expected: 'no semicolons (ASI style)',
        context: line,
      });
    }
  }

  return evidence;
}

// ── helpers ──

/** Check if filename looks like a test file. */
export function isTestFile(fileName: string): boolean {
  return fileName.endsWith('.test.ts') || fileName.endsWith('.spec.ts')
    || fileName.endsWith('.test.js') || fileName.endsWith('.spec.js');
}
