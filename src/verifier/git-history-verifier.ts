/**
 * Git history verifier.
 *
 * Routes git-history rules to specialized checks in git-history-checks.ts.
 * Handles repository detection and graceful fallback when git is unavailable.
 */

import { execSync } from 'node:child_process';
import type { Rule, RuleResult } from '../types.js';
import {
  checkCommitMessagePattern,
  checkConventionalCommits,
  checkCommitPrefix,
  checkBranchNaming,
  checkSignedCommits,
} from './git-history-checks.js';

/**
 * Verify a git-history rule against the project's git log.
 *
 * Routes by pattern.type to specialized checks for commit messages,
 * branch naming, and other git metadata.
 *
 * @param rule - The git-history rule to verify
 * @param outputDir - Root directory of the project (git working tree)
 * @returns RuleResult with compliance score and evidence
 */
export function verifyGitHistoryRule(
  rule: Rule,
  outputDir: string,
): RuleResult {
  if (!isGitRepo(outputDir)) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: outputDir,
        line: null,
        found: 'not a git repository, skipping git history check',
        expected: 'git repository',
        context: 'Git history verification requires a git repo',
      }],
    };
  }

  const checkType = rule.pattern.type;

  switch (checkType) {
    case 'commit-message-pattern':
      return checkCommitMessagePattern(rule, outputDir);
    case 'conventional-commits':
      return checkConventionalCommits(rule, outputDir);
    case 'commit-message-prefix':
      return checkCommitPrefix(rule, outputDir);
    case 'branch-naming':
      return checkBranchNaming(rule, outputDir);
    case 'signed-commits':
      return checkSignedCommits(rule, outputDir);
    default:
      return { rule, passed: true, compliance: 1, evidence: [] };
  }
}

/**
 * Check whether the directory is a git repository root.
 *
 * Only returns true if the outputDir IS the repo root (has .git/),
 * not just any subdirectory inside a git repo. This prevents false
 * positives when verifying agent output that happens to be inside
 * a parent git repo.
 */
function isGitRepo(dir: string): boolean {
  try {
    const topLevel = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: 'pipe',
      timeout: 5000,
    }).toString('utf-8').trim();
    // Only treat as a git repo if this directory IS the repo root
    return topLevel === dir || topLevel === dir.replace(/\/$/, '');
  } catch {
    return false;
  }
}
