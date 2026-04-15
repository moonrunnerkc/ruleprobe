/**
 * Config-file verifier.
 *
 * Routes config-file rules to specialized checks for CI config,
 * git hooks, pre-commit scripts, environment tools, and npm scripts.
 *
 * Heavy checks (CI commands, CI presence, scripts, env tools) live in
 * config-file-checks.ts. This file keeps the router, git-hook checks,
 * and pre-commit checks.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  checkCiCommand,
  checkCiConfigPresent,
  checkScriptPresent,
  checkEnvTool,
} from './config-file-checks.js';

/**
 * Verify a config-file rule against the project.
 *
 * Routes by pattern.type to specialized checks for CI config,
 * git hooks, pre-commit scripts, and environment tools.
 *
 * @param rule - The config-file rule to verify
 * @param outputDir - Root directory of the project
 * @param allFiles - All files discovered in the project
 * @returns RuleResult with compliance score and evidence
 */
export function verifyConfigFileRule(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const checkType = rule.pattern.type;

  switch (checkType) {
    case 'ci-command-present':
      return checkCiCommand(rule, outputDir, allFiles);
    case 'git-hook-present':
      return checkGitHook(rule, outputDir, allFiles);
    case 'script-present':
      return checkScriptPresent(rule, outputDir);
    case 'env-tool-present':
      return checkEnvTool(rule, outputDir, allFiles);
    case 'ci-config-present':
      return checkCiConfigPresent(rule, outputDir, allFiles);
    case 'pre-commit-check':
      return checkPreCommitHook(rule, outputDir, allFiles);
    default:
      return { rule, passed: true, compliance: 1, evidence: [] };
  }
}

/**
 * Check if a specific git hook is configured (husky, lefthook, etc).
 */
function checkGitHook(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const evidence: Evidence[] = [];
  const hookName = rule.pattern.target;
  let found = false;

  // Check husky hooks
  const huskyPath = join(outputDir, '.husky', hookName);
  if (existsSync(huskyPath)) {
    found = true;
  }

  // Check lefthook config
  if (!found) {
    const lefthookFiles = ['lefthook.yml', '.lefthook.yml', 'lefthook.yaml'];
    for (const lf of lefthookFiles) {
      const lfPath = join(outputDir, lf);
      if (existsSync(lfPath)) {
        try {
          const content = readFileSync(lfPath, 'utf-8');
          if (content.includes(hookName)) {
            found = true;
            break;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  // Check package.json for husky config
  if (!found) {
    const pkgPath = join(outputDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as Record<string, unknown>;
        const husky = pkg['husky'] as Record<string, unknown> | undefined;
        const hooks = husky?.['hooks'] as Record<string, string> | undefined;
        if (hooks?.[hookName]) {
          found = true;
        }
        // Also check lint-staged (implies pre-commit)
        if (!found && hookName === 'pre-commit' && pkg['lint-staged']) {
          found = true;
        }
      } catch {
        // Skip
      }
    }
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `git hook "${hookName}" not configured`,
      expected: `"${hookName}" hook in husky, lefthook, or package.json`,
      context: 'Checked .husky/, lefthook.yml, and package.json husky config',
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}

/**
 * Check if a pre-commit hook runs a specific command.
 * For rules like "run npm test before committing."
 */
function checkPreCommitHook(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const evidence: Evidence[] = [];
  const command = rule.pattern.target;
  let found = false;

  // Check husky pre-commit
  const huskyPreCommit = join(outputDir, '.husky', 'pre-commit');
  if (existsSync(huskyPreCommit)) {
    try {
      const content = readFileSync(huskyPreCommit, 'utf-8');
      if (content.includes(command)) {
        found = true;
      }
    } catch {
      // Skip
    }
  }

  // Check lefthook pre-commit section
  if (!found) {
    const lefthookFiles = ['lefthook.yml', '.lefthook.yml'];
    for (const lf of lefthookFiles) {
      const lfPath = join(outputDir, lf);
      if (existsSync(lfPath)) {
        try {
          const content = readFileSync(lfPath, 'utf-8');
          // Simple check: if pre-commit section exists and references the command
          if (content.includes('pre-commit') && content.includes(command)) {
            found = true;
            break;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  // Check lint-staged config
  if (!found) {
    const pkgPath = join(outputDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        if (content.includes('lint-staged') && content.includes(command)) {
          found = true;
        }
      } catch {
        // Skip
      }
    }
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `pre-commit hook does not run "${command}"`,
      expected: `"${command}" in pre-commit hook configuration`,
      context: 'Checked .husky/pre-commit, lefthook.yml, and lint-staged',
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}
