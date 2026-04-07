/**
 * Verification orchestrator.
 *
 * Takes a RuleSet and an output directory, routes each rule to
 * the correct verifier (AST, filesystem, or regex), collects all
 * RuleResults, and returns them. Handles errors gracefully: if a
 * file can't be parsed, it's logged in evidence and skipped.
 */

import { extname } from 'node:path';
import type { Rule, RuleSet, RuleResult } from '../types.js';
import { verifyAstRule } from './ast-verifier.js';
import { verifyFileSystemRule, collectFiles, filterSourceFiles } from './file-verifier.js';
import { verifyRegexRule } from './regex-verifier.js';

/** Options for output verification. */
export interface VerifyOptions {
  /** Whether to follow symlinks during directory traversal. Defaults to false. */
  allowSymlinks?: boolean;
}

/**
 * Verify all rules in a RuleSet against files in an output directory.
 *
 * Routes each rule to the appropriate verifier based on rule.verifier.
 * Collects source files once and reuses the list across rules to avoid
 * repeated directory traversals.
 *
 * @param ruleSet - The set of rules to verify
 * @param outputDir - Root directory containing agent-generated output
 * @param options - Verification options (allowSymlinks, etc.)
 * @returns Array of RuleResults, one per rule, in the same order as ruleSet.rules
 */
export function verifyOutput(
  ruleSet: RuleSet,
  outputDir: string,
  options: VerifyOptions = {},
): RuleResult[] {
  const allowSymlinks = options.allowSymlinks ?? false;
  const allFiles = collectFiles(outputDir, allowSymlinks);
  const sourceFiles = filterSourceFiles(allFiles);

  // Filter to TypeScript/JavaScript files for AST and regex checks
  const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const codeFiles = allFiles.filter((f) => codeExtensions.has(extname(f)));

  const results: RuleResult[] = [];

  for (const rule of ruleSet.rules) {
    const result = verifyRule(rule, outputDir, codeFiles, sourceFiles, allowSymlinks);
    results.push(result);
  }

  return results;
}

/**
 * Verify a single rule, routing to the correct verifier.
 *
 * @param rule - The rule to verify
 * @param outputDir - Root directory of agent output
 * @param codeFiles - Pre-collected code file paths
 * @param sourceFiles - Pre-collected source file paths
 * @returns The verification result
 */
function verifyRule(
  rule: Rule,
  outputDir: string,
  codeFiles: string[],
  sourceFiles: string[],
  allowSymlinks: boolean,
): RuleResult {
  switch (rule.verifier) {
    case 'ast':
      return verifyAstRule(rule, codeFiles);
    case 'filesystem':
      return verifyFileSystemRule(rule, outputDir, allowSymlinks);
    case 'regex':
      return verifyRegexRule(rule, sourceFiles, outputDir);
    default:
      return {
        rule,
        passed: true,
        evidence: [],
      };
  }
}

export { verifyAstRule } from './ast-verifier.js';
export { verifyFileSystemRule } from './file-verifier.js';
export { verifyRegexRule } from './regex-verifier.js';
