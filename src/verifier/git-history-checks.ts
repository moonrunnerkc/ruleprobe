/**
 * Git history check functions: commit messages, branches, signatures.
 * Extracted from git-history-verifier.ts for the 300-line file limit.
 */

import { execSync } from 'node:child_process';
import type { Rule, RuleResult, Evidence } from '../types.js';

/** Maximum number of recent commits to inspect. Keeps verification fast on large repos. */
export const MAX_COMMITS_TO_CHECK = 50;

/** Conventional commit prefix pattern: type(scope?): description */
export const CONVENTIONAL_COMMIT_RE =
  /^(feat|fix|chore|refactor|docs|test|ci|perf|style|revert|build)(\(.+?\))?[!]?:\s+\S/;

/** Get recent commit messages from git log. */
export function getRecentCommits(
  dir: string,
  count: number = MAX_COMMITS_TO_CHECK,
): string[] {
  try {
    const output = execSync(
      `git log --format=%s -n ${count}`,
      { cwd: dir, stdio: 'pipe', timeout: 10000 },
    ).toString('utf-8').trim();
    if (!output) return [];
    return output.split('\n').filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/** Only report up to 5 violations to keep output manageable. */
const MAX_VIOLATIONS = 5;

/**
 * Check commit messages against a custom regex pattern.
 */
export function checkCommitMessagePattern(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const pattern = rule.pattern.target;
  const commits = getRecentCommits(outputDir);

  if (commits.length === 0) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: outputDir,
        line: null,
        found: 'no commits found',
        expected: `commits matching pattern: ${pattern}`,
        context: 'Empty or new repository',
      }],
    };
  }

  let matchingRegex: RegExp;
  try {
    matchingRegex = new RegExp(pattern, 'i');
  } catch {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: outputDir,
        line: null,
        found: `invalid regex pattern: ${pattern}`,
        expected: 'valid regex for commit message matching',
        context: 'Could not compile the pattern as a regular expression',
      }],
    };
  }

  let matching = 0;
  for (const msg of commits) {
    if (matchingRegex.test(msg)) {
      matching++;
    } else {
      evidence.push({
        file: outputDir,
        line: null,
        found: msg,
        expected: `matches: ${pattern}`,
        context: 'Commit message does not match required pattern',
      });
    }
  }

  const compliance = commits.length > 0 ? matching / commits.length : 1;
  return {
    rule,
    passed: compliance >= 0.8,
    compliance,
    evidence: evidence.slice(0, MAX_VIOLATIONS),
  };
}

/**
 * Check whether commits follow the conventional commits format.
 */
export function checkConventionalCommits(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const commits = getRecentCommits(outputDir);

  if (commits.length === 0) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  let matching = 0;
  for (const msg of commits) {
    if (CONVENTIONAL_COMMIT_RE.test(msg)) {
      matching++;
    } else {
      evidence.push({
        file: outputDir,
        line: null,
        found: msg,
        expected: 'conventional commit format (type(scope?): description)',
        context: 'Commit does not follow conventional commits specification',
      });
    }
  }

  const compliance = commits.length > 0 ? matching / commits.length : 1;
  return {
    rule,
    passed: compliance >= 0.8,
    compliance,
    evidence: evidence.slice(0, MAX_VIOLATIONS),
  };
}

/**
 * Check whether commits have a specific prefix (e.g., "[AI]").
 */
export function checkCommitPrefix(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const prefix = rule.pattern.target;
  const commits = getRecentCommits(outputDir);

  if (commits.length === 0) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  let matching = 0;
  for (const msg of commits) {
    if (msg.startsWith(prefix) || msg.toLowerCase().startsWith(prefix.toLowerCase())) {
      matching++;
    } else {
      evidence.push({
        file: outputDir,
        line: null,
        found: msg.substring(0, 80),
        expected: `prefix: "${prefix}"`,
        context: 'Commit message is missing the required prefix',
      });
    }
  }

  const compliance = commits.length > 0 ? matching / commits.length : 1;
  return {
    rule,
    passed: compliance >= 0.8,
    compliance,
    evidence: evidence.slice(0, MAX_VIOLATIONS),
  };
}

/**
 * Check whether the current branch follows a naming pattern.
 */
export function checkBranchNaming(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const pattern = rule.pattern.target;

  let branchName: string;
  try {
    branchName = execSync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: outputDir, stdio: 'pipe', timeout: 5000 },
    ).toString('utf-8').trim();
  } catch {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: outputDir,
        line: null,
        found: 'could not determine current branch',
        expected: `branch matching: ${pattern}`,
        context: 'Git branch detection failed',
      }],
    };
  }

  // Skip check for main/master/develop (protected branches)
  const protectedBranches = ['main', 'master', 'develop', 'HEAD'];
  if (protectedBranches.includes(branchName)) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  let matchingRegex: RegExp;
  try {
    matchingRegex = new RegExp(pattern);
  } catch {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  const matches = matchingRegex.test(branchName);
  if (!matches) {
    evidence.push({
      file: outputDir,
      line: null,
      found: branchName,
      expected: `matches: ${pattern}`,
      context: 'Branch name does not follow the required pattern',
    });
  }

  return {
    rule,
    passed: matches,
    compliance: matches ? 1 : 0,
    evidence,
  };
}

/**
 * Check whether recent commits are signed (GPG or SSH).
 */
export function checkSignedCommits(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];

  let signedInfo: string;
  try {
    signedInfo = execSync(
      `git log --format="%H %G?" -n ${MAX_COMMITS_TO_CHECK}`,
      { cwd: outputDir, stdio: 'pipe', timeout: 10000 },
    ).toString('utf-8').trim();
  } catch {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  if (!signedInfo) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  const lines = signedInfo.split('\n');
  let signed = 0;
  for (const line of lines) {
    const parts = line.trim().split(' ');
    const status = parts[1];
    // G = good signature, U = good signature untrusted key
    if (status === 'G' || status === 'U') {
      signed++;
    }
  }

  const compliance = lines.length > 0 ? signed / lines.length : 1;
  if (compliance < 0.8) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `${signed}/${lines.length} commits are signed`,
      expected: 'all commits signed',
      context: 'Instruction requires signed commits (GPG or SSH)',
    });
  }

  return {
    rule,
    passed: compliance >= 0.8,
    compliance,
    evidence,
  };
}
