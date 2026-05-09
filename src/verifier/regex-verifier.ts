/**
 * Regex-based verifier for pattern matching on file contents.
 *
 * Reads files as plain text and routes to check functions
 * defined in regex-checks.ts based on the rule's pattern type.
 * Unknown pattern types are skipped rather than false-passed.
 */

import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  checkMaxLineLength,
  checkNoTsDirectives,
  checkNoTestOnly,
  checkNoTestSkip,
  checkQuoteStyle,
  checkBannedImport,
  checkNoTodoComments,
  checkConsistentSemicolons,
} from './regex-checks.js';
import {
  checkDescribeItStructure,
  checkNoConsoleInTests,
} from './test-regex-checks.js';

/** Pattern types handled by the regex verifier. */
const SUPPORTED_REGEX_PATTERNS = new Set([
  'max-line-length',
  'no-ts-directives',
  'no-test-only',
  'no-test-skip',
  'quote-style',
  'banned-import',
  'no-todo-comments',
  'consistent-semicolons',
  'describe-it-structure',
  'no-console-in-tests',
]);

/**
 * Routes to the appropriate check function based on the rule's
 * verification pattern type. Reads each file as text and runs
 * the pattern check. Returns skipped for unknown pattern types.
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to files to check
 * @param outputDir - Root directory for relative path computation
 * @returns A RuleResult with pass/fail and evidence, or skipped for unsupported patterns
 */
export function verifyRegexRule(
  rule: Rule,
  filePaths: string[],
  outputDir: string,
): RuleResult {
  const patternType = rule.pattern.type;

  // Skip unknown pattern types instead of false-passing
  if (!SUPPORTED_REGEX_PATTERNS.has(patternType)) {
    return {
      rule,
      passed: false,
      compliance: 0,
      evidence: [],
      skipped: true,
    };
  }

  const allEvidence: Evidence[] = [];

  for (const fp of filePaths) {
    try {
      const content = readFileSync(fp, 'utf-8');
      const relPath = relative(outputDir, fp);
      const fileName = basename(fp);

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
        case 'no-todo-comments':
          allEvidence.push(...checkNoTodoComments(content, relPath));
          break;
        case 'consistent-semicolons': {
          const semiStyle = typeof rule.pattern.expected === 'string'
            ? rule.pattern.expected
            : 'always';
          allEvidence.push(...checkConsistentSemicolons(content, relPath, semiStyle));
          break;
        }
        case 'describe-it-structure':
          allEvidence.push(...checkDescribeItStructure(content, relPath, fileName));
          break;
        case 'no-console-in-tests':
          allEvidence.push(...checkNoConsoleInTests(content, relPath, fileName));
          break;
      }
    } catch {
      // Skip files we can't read
    }
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    compliance: allEvidence.length === 0 ? 1 : 0,
    evidence: allEvidence,
  };
}
