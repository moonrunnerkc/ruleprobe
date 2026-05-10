/**
 * Verification orchestrator.
 *
 * Takes a RuleSet and an output directory, routes each rule to
 * the correct verifier (AST, filesystem, or regex),
 * collects all RuleResults, and returns them. Handles errors
 * gracefully: if a file can't be parsed, it's logged in evidence.
 *
 * AST rules are batched into a single ts-morph pass over all files
 * to avoid O(rules * files) parsing. Each file is parsed once and
 * checked against all AST rules, then discarded from memory.
 */

import type { Rule, RuleSet, RuleResult } from '../types.js';
import { verifyAstRulesBatch } from './ast-verifier-batch.js';
import { verifyFileSystemRule, collectFiles, filterSourceFiles, filterTreeSitterFiles } from './file-verifier.js';
export { verifyFileSystemRule } from './file-verifier.js';
import { verifyRegexRule } from './regex-verifier.js';
import { verifyTreeSitterRule } from './treesitter-verifier.js';

/** Options for output verification. */
export interface VerifyOptions {
  /** Whether to follow symlinks during directory traversal. Defaults to false. */
  allowSymlinks?: boolean;
  /** Path to tsconfig.json for type-aware AST checks. */
  projectPath?: string;
  /** Set of changed file paths (relative to repo root). When set, only
   * these files are checked in incremental mode. */
  changedFiles?: Set<string>;
}

/**
 * Verify all rules in a RuleSet against files in an output directory.
 *
 * Routes each rule to the appropriate verifier based on rule.verifier.
 * Collects source files once and reuses the list across rules to avoid
 * repeated directory traversals. AST rules are batched into a single
 * ts-morph pass to achieve O(files) instead of O(rules * files) parses.
 *
 * When `changedFiles` is provided, only those files are checked, enabling
 * incremental verification on PRs without surfacing pre-existing violations.
 *
 * @param ruleSet - The set of rules to verify
 * @param outputDir - Root directory containing agent-generated output
 * @param options - Verification options (allowSymlinks, changedFiles, etc.)
 * @returns Array of RuleResults, one per rule, in the same order as ruleSet.rules
 */
export async function verifyOutput(
  ruleSet: RuleSet,
  outputDir: string,
  options: VerifyOptions = {},
): Promise<RuleResult[]> {
  const allowSymlinks = options.allowSymlinks ?? false;
  const projectPath = options.projectPath;
  const changedFiles = options.changedFiles;
  const allFiles = collectFiles(outputDir, allowSymlinks);

  const sourceFiles = filterSourceFiles(allFiles);
  const treeSitterFiles = filterTreeSitterFiles(allFiles);

  // AST and regex rules pre-filter to changed files for efficiency: they
  // have no cross-file dependency, so unchanged files can be skipped
  // outright in incremental mode.
  const filteredSourceFiles = changedFiles
    ? sourceFiles.filter((f) => changedFiles.has(f))
    : sourceFiles;
  const filteredTreeSitterFiles = changedFiles
    ? treeSitterFiles.filter((f) => changedFiles.has(f))
    : treeSitterFiles;

  // Filesystem rules receive the FULL file list and the changed-set
  // alongside. Cross-file checks (e.g. test-files-exist) need the full
  // picture to look up files outside the diff; per-file checks filter
  // internally using changedFiles.

  // Filter to TypeScript/JavaScript files for AST and regex checks
  const codeFiles = filteredSourceFiles;

  // Batch all AST rules for single-pass verification
  const astRules = ruleSet.rules.filter((r) => r.verifier === 'ast');
  const astResultMap = astRules.length > 0
    ? verifyAstRulesBatch(astRules, codeFiles, projectPath)
    : new Map<Rule, RuleResult>();

  // Verify remaining rule types individually
  const results: RuleResult[] = [];
  for (const rule of ruleSet.rules) {
    if (rule.verifier === 'ast') {
      results.push(astResultMap.get(rule)!);
    } else {
      const result = await verifyNonAstRule(
        rule, outputDir, codeFiles, filteredSourceFiles, allFiles, filteredTreeSitterFiles, projectPath,
        changedFiles,
      );
      results.push(result);
    }
  }

  return results;
}

/**
 * Verify a single non-AST rule, routing to the correct verifier.
 *
 * Tree-sitter rules run against Python and Go files (pre-filtered to
 * changed files when in incremental mode). Filesystem rules receive
 * the full file list plus `changedFiles` so cross-file checks like
 * test-files-exist can resolve test paths outside the diff. Regex
 * rules use the TS/JS source list (also pre-filtered).
 */
async function verifyNonAstRule(
  rule: Rule,
  outputDir: string,
  codeFiles: string[],
  sourceFiles: string[],
  allFiles: string[],
  treeSitterFiles: string[],
  _projectPath?: string,
  changedFiles?: Set<string>,
): Promise<RuleResult> {
  switch (rule.verifier) {
    case 'filesystem':
      return verifyFileSystemRule(rule, outputDir, allFiles, changedFiles);
    case 'regex':
      return verifyRegexRule(rule, sourceFiles, outputDir);
    case 'treesitter':
      return verifyTreeSitterRule(rule, treeSitterFiles);
    default:
      return {
        rule,
        passed: false,
        compliance: 0,
        evidence: [],
        skipped: true,
      };
  }
}
