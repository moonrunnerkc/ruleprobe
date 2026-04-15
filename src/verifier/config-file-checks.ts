/**
 * Config-file checks: CI, scripts, and environment tools.
 *
 * Extracted from config-file-verifier.ts for the 300-line file limit.
 * Contains checks for CI workflow commands, CI configuration presence,
 * npm script presence, and environment tool manifests.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';

/** CI workflow directories relative to project root. */
export const CI_WORKFLOW_DIRS = [
  '.github/workflows',
  '.circleci',
  '.gitlab',
];

/** Common environment tool manifest files. */
export const ENV_TOOL_MANIFESTS: Record<string, string[]> = {
  'flox': ['.flox/env.toml', 'flox.toml', '.flox'],
  'nix': ['flake.nix', 'shell.nix', 'default.nix'],
  'devcontainer': ['.devcontainer/devcontainer.json', '.devcontainer.json'],
  'mise': ['.mise.toml', 'mise.toml', '.tool-versions'],
  'asdf': ['.tool-versions'],
  'volta': ['package.json'],
  'fnm': ['.node-version', '.nvmrc'],
  'nvm': ['.nvmrc'],
  'direnv': ['.envrc'],
};

/**
 * Check if a specific command appears in CI workflow files.
 *
 * @param rule - The rule requiring a CI command
 * @param outputDir - Project root directory
 * @param allFiles - All files in the project
 * @returns RuleResult indicating whether the command was found
 */
export function checkCiCommand(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const evidence: Evidence[] = [];
  const command = rule.pattern.target;
  let found = false;

  const ciFiles = allFiles.filter((f) => {
    const rel = relative(outputDir, f);
    return CI_WORKFLOW_DIRS.some((dir) => rel.startsWith(dir));
  });

  for (const file of ciFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (content.includes(command)) {
        found = true;
        break;
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `command "${command}" not found in CI workflow files`,
      expected: `"${command}" in CI configuration`,
      context: `Checked ${ciFiles.length} CI workflow file(s)`,
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}

/**
 * Check if CI configuration exists at all (any CI provider).
 *
 * @param rule - The rule requiring CI config
 * @param outputDir - Project root directory
 * @param allFiles - All files in the project
 * @returns RuleResult indicating whether any CI config was found
 */
export function checkCiConfigPresent(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const evidence: Evidence[] = [];
  let found = false;

  const ciIndicators = [
    '.github/workflows',
    '.circleci/config.yml',
    '.gitlab-ci.yml',
    'Jenkinsfile',
    '.travis.yml',
    'azure-pipelines.yml',
    'bitbucket-pipelines.yml',
  ];

  for (const indicator of ciIndicators) {
    if (existsSync(join(outputDir, indicator))) {
      found = true;
      break;
    }
  }

  if (!found) {
    found = allFiles.some((f) => {
      const rel = relative(outputDir, f);
      return CI_WORKFLOW_DIRS.some((dir) => rel.startsWith(dir));
    });
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: 'no CI configuration detected',
      expected: 'CI workflow files (GitHub Actions, CircleCI, GitLab CI, etc.)',
      context: 'Instruction references CI/CD configuration',
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}

/**
 * Check if a specific npm script exists in package.json.
 *
 * @param rule - The rule requiring a script
 * @param outputDir - Project root directory
 * @returns RuleResult indicating whether the script was found
 */
export function checkScriptPresent(
  rule: Rule,
  outputDir: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const scriptName = rule.pattern.target;
  let found = false;

  const pkgPath = join(outputDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const content = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, string> | undefined;
      if (scripts?.[scriptName]) {
        found = true;
      }
    } catch {
      // Skip
    }
  }

  if (!found) {
    evidence.push({
      file: join(outputDir, 'package.json'),
      line: null,
      found: `script "${scriptName}" not found in package.json`,
      expected: `"${scriptName}" in scripts`,
      context: 'Instruction requires this npm script to be defined',
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}

/**
 * Check if an environment tool is configured.
 *
 * Inspects known manifest paths, package.json special fields,
 * and falls back to content search in config files.
 *
 * @param rule - The rule requiring the env tool
 * @param outputDir - Project root directory
 * @param allFiles - All files in the project
 * @returns RuleResult indicating whether the tool config was found
 */
export function checkEnvTool(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const evidence: Evidence[] = [];
  const toolName = rule.pattern.target.toLowerCase();
  let found = false;

  // Check known manifest paths
  const manifests = ENV_TOOL_MANIFESTS[toolName];
  if (manifests) {
    for (const manifest of manifests) {
      const fullPath = join(outputDir, manifest);
      if (existsSync(fullPath)) {
        found = true;
        break;
      }
    }
  }

  // Special case: volta is configured inside package.json
  if (!found && toolName === 'volta') {
    const pkgPath = join(outputDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as Record<string, unknown>;
        if (pkg['volta']) {
          found = true;
        }
      } catch {
        // Skip
      }
    }
  }

  // Fallback: search config files for tool name
  if (!found) {
    const configExtensions = ['.json', '.yml', '.yaml', '.toml', '.cfg'];
    for (const fp of allFiles) {
      if (configExtensions.some((ext) => fp.endsWith(ext))) {
        try {
          const content = readFileSync(fp, 'utf-8');
          if (content.toLowerCase().includes(toolName)) {
            found = true;
            break;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `environment tool "${toolName}" not configured`,
      expected: `${toolName} manifest or configuration`,
      context: `Instruction requires ${toolName}`,
    });
  }

  return { rule, passed: found, compliance: found ? 1 : 0, evidence };
}
