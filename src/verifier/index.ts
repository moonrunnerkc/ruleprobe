/**
 * Verification orchestrator.
 *
 * Takes a RuleSet and an output directory, routes each rule to
 * the correct verifier (AST, filesystem, regex, or tree-sitter),
 * collects all RuleResults, and returns them. Handles errors
 * gracefully: if a file can't be parsed, it's logged in evidence.
 *
 * AST rules are batched into a single ts-morph pass over all files
 * to avoid O(rules * files) parsing. Each file is parsed once and
 * checked against all AST rules, then discarded from memory.
 */

import { extname } from 'node:path';
import type { Rule, RuleSet, RuleResult } from '../types.js';
import { verifyAstRulesBatch } from './ast-verifier-batch.js';
import { verifyFileSystemRule, collectFiles, filterSourceFiles } from './file-verifier.js';
export { verifyFileSystemRule } from './file-verifier.js';
import { verifyRegexRule } from './regex-verifier.js';
import { verifyTreeSitterRule } from './treesitter-verifier.js';
import { verifyPreferenceRule } from './preference-verifier.js';
import { verifyToolingRule } from './tooling-verifier.js';
import { verifyConfigFileRule } from './config-file-verifier.js';
import { verifyGitHistoryRule } from './git-history-verifier.js';

/** Options for output verification. */
export interface VerifyOptions {
  /** Whether to follow symlinks during directory traversal. Defaults to false. */
  allowSymlinks?: boolean;
  /** Path to tsconfig.json for type-aware AST checks. */
  projectPath?: string;
}

/**
 * Verify all rules in a RuleSet against files in an output directory.
 *
 * Routes each rule to the appropriate verifier based on rule.verifier.
 * Collects source files once and reuses the list across rules to avoid
 * repeated directory traversals. AST rules are batched into a single
 * ts-morph pass to achieve O(files) instead of O(rules * files) parses.
 *
 * @param ruleSet - The set of rules to verify
 * @param outputDir - Root directory containing agent-generated output
 * @param options - Verification options (allowSymlinks, etc.)
 * @returns Array of RuleResults, one per rule, in the same order as ruleSet.rules
 */
export async function verifyOutput(
  ruleSet: RuleSet,
  outputDir: string,
  options: VerifyOptions = {},
): Promise<RuleResult[]> {
  const allowSymlinks = options.allowSymlinks ?? false;
  const projectPath = options.projectPath;
  const allFiles = collectFiles(outputDir, allowSymlinks);
  const sourceFiles = filterSourceFiles(allFiles);

  // Filter to TypeScript/JavaScript files for AST and regex checks
  // (sourceFiles already excludes minified files via filterSourceFiles)
  const codeFiles = sourceFiles;

  // Filter to Python and Go files for tree-sitter checks
  const treeSitterExtensions = new Set(['.py', '.go']);
  const treeSitterFiles = allFiles.filter((f) => treeSitterExtensions.has(extname(f)));

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
        rule, outputDir, codeFiles, sourceFiles, allFiles, treeSitterFiles, projectPath,
      );
      results.push(result);
    }
  }

  return results;
}

/**
 * Verify a single non-AST rule, routing to the correct verifier.
 */
async function verifyNonAstRule(
  rule: Rule,
  outputDir: string,
  codeFiles: string[],
  sourceFiles: string[],
  allFiles: string[],
  treeSitterFiles: string[],
  projectPath?: string,
): Promise<RuleResult> {
  switch (rule.verifier) {
    case 'filesystem':
      return verifyFileSystemRule(rule, outputDir, allFiles);
    case 'regex':
      return verifyRegexRule(rule, sourceFiles, outputDir);
    case 'treesitter':
      return verifyTreeSitterRule(rule, treeSitterFiles);
    case 'preference':
      return verifyPreferenceRule(rule, codeFiles);
    case 'tooling':
      return verifyToolingRule(rule, outputDir, allFiles);
    case 'config-file':
      return verifyConfigFileRule(rule, outputDir, allFiles);
    case 'git-history':
      return verifyGitHistoryRule(rule, outputDir);
    default:
      return {
        rule,
        passed: true,
        compliance: 1,
        evidence: [],
      };
  }
}

