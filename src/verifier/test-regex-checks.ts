/**
 * Regex-based checks for test file patterns.
 *
 * Contains checks for describe/it structure and console
 * statements in test files.
 */

import type { Evidence } from '../types.js';
import { isTestFile } from './regex-checks.js';

/**
 * Check that test files use describe/it block structure.
 *
 * Only checks files that appear to be test files. Flags test files
 * that contain no describe() or it()/test() calls.
 */
export function checkDescribeItStructure(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!isTestFile(fileName)) {
    return [];
  }

  const evidence: Evidence[] = [];
  const hasDescribe = /\bdescribe\s*\(/.test(content);
  const hasItOrTest = /\b(?:it|test)\s*\(/.test(content);

  if (!hasDescribe) {
    evidence.push({
      file: filePath,
      line: null,
      found: 'no describe() blocks',
      expected: 'describe/it block structure',
      context: 'Test file should use describe() to group related tests',
    });
  }

  if (!hasItOrTest) {
    evidence.push({
      file: filePath,
      line: null,
      found: 'no it() or test() calls',
      expected: 'describe/it block structure',
      context: 'Test file should use it() or test() for individual tests',
    });
  }

  return evidence;
}

/**
 * Check that test files do not contain console statements.
 */
export function checkNoConsoleInTests(
  content: string,
  filePath: string,
  fileName: string,
): Evidence[] {
  if (!isTestFile(fileName)) {
    return [];
  }

  const evidence: Evidence[] = [];
  const lines = content.split('\n');
  const consolePattern = /\bconsole\.(log|warn|error|info|debug)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (consolePattern.test(line)) {
      evidence.push({
        file: filePath,
        line: i + 1,
        found: 'console statement in test',
        expected: 'no console in tests',
        context: line.trim(),
      });
    }
  }

  return evidence;
}
