/**
 * Tooling/dependency alignment verifier.
 *
 * Checks whether tool and package references from instruction files
 * are present in the project configuration (package.json, lockfiles,
 * CI configs, testing configs).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';

/** Lockfile names mapped to their package manager. */
const LOCKFILE_MAP: Record<string, string> = {
  'pnpm-lock.yaml': 'pnpm',
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
};

/** Config file patterns for test frameworks. */
const TEST_FRAMEWORK_CONFIGS: Record<string, string[]> = {
  'vitest': ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'],
  'jest': ['jest.config.ts', 'jest.config.js', 'jest.config.cjs', 'jest.config.mjs'],
  'mocha': ['.mocharc.yml', '.mocharc.yaml', '.mocharc.json', '.mocharc.js'],
  'pytest': ['pytest.ini', 'pyproject.toml', 'setup.cfg', 'conftest.py'],
};

/**
 * Verify a tooling alignment rule against project configuration.
 *
 * Checks package.json, lockfiles, CI configs, and test framework
 * configs to determine if the specified tool is present.
 *
 * @param rule - The tooling rule to verify
 * @param outputDir - Root directory of the project
 * @param allFiles - All files in the project
 * @returns RuleResult with compliance ratio
 */
export function verifyToolingRule(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
): RuleResult {
  const toolName = rule.pattern.target;
  const checkType = rule.pattern.type;

  switch (checkType) {
    case 'package-manager':
      return checkPackageManager(rule, outputDir, allFiles, toolName);
    case 'test-framework':
      return checkTestFramework(rule, outputDir, allFiles, toolName);
    case 'tool-present':
      return checkToolPresent(rule, outputDir, allFiles, toolName);
    default:
      return { rule, passed: true, compliance: 1, evidence: [] };
  }
}

/**
 * Check that the expected package manager's lockfile is present.
 */
function checkPackageManager(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
  expected: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const fileNames = allFiles.map((f) => basename(f));

  // Find all lockfiles present
  const presentManagers: string[] = [];
  for (const [lockfile, manager] of Object.entries(LOCKFILE_MAP)) {
    if (fileNames.includes(lockfile)) {
      presentManagers.push(manager);
    }
  }

  const hasExpected = presentManagers.includes(expected);
  const competitors = presentManagers.filter((m) => m !== expected);

  if (!hasExpected) {
    evidence.push({
      file: outputDir,
      line: null,
      found: presentManagers.length > 0
        ? `found lockfile for ${presentManagers.join(', ')}, not ${expected}`
        : 'no lockfile found',
      expected: `${expected} lockfile`,
      context: `Instruction requires ${expected} as package manager`,
    });
  }

  if (competitors.length > 0 && hasExpected) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `competing package manager lockfiles: ${competitors.join(', ')}`,
      expected: `only ${expected}`,
      context: `Both ${expected} and ${competitors.join(', ')} lockfiles present`,
    });
  }

  const compliance = hasExpected ? (competitors.length > 0 ? 0.5 : 1) : 0;
  return { rule, passed: compliance >= 0.8, compliance, evidence };
}

/**
 * Check that the expected test framework is configured.
 */
function checkTestFramework(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
  expected: string,
): RuleResult {
  const evidence: Evidence[] = [];
  const fileNames = new Set(allFiles.map((f) => basename(f)));

  // Check config files
  const configs = TEST_FRAMEWORK_CONFIGS[expected] ?? [];
  const hasConfig = configs.some((c) => fileNames.has(c));

  // Check package.json for the framework as a dependency
  const pkgJsonPath = join(outputDir, 'package.json');
  let inPackageJson = false;
  if (existsSync(pkgJsonPath)) {
    try {
      const content = readFileSync(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps = pkg['dependencies'] as Record<string, string> | undefined;
      const devDeps = pkg['devDependencies'] as Record<string, string> | undefined;
      const scripts = pkg['scripts'] as Record<string, string> | undefined;
      inPackageJson = !!(deps?.[expected] || devDeps?.[expected]);

      // Also check scripts for the tool name
      if (scripts) {
        for (const script of Object.values(scripts)) {
          if (script.includes(expected)) {
            inPackageJson = true;
            break;
          }
        }
      }
    } catch {
      // Skip unparseable package.json
    }
  }

  const found = hasConfig || inPackageJson;
  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `${expected} not found in config files or package.json`,
      expected: `${expected} configured`,
      context: `Instruction requires ${expected}`,
    });
  }

  return {
    rule,
    passed: found,
    compliance: found ? 1 : 0,
    evidence,
  };
}

/**
 * Check that a named tool is present in project configuration.
 */
function checkToolPresent(
  rule: Rule,
  outputDir: string,
  allFiles: string[],
  toolName: string,
): RuleResult {
  const evidence: Evidence[] = [];

  // Check package.json
  const pkgJsonPath = join(outputDir, 'package.json');
  let found = false;
  if (existsSync(pkgJsonPath)) {
    try {
      const content = readFileSync(pkgJsonPath, 'utf-8');
      if (content.includes(toolName)) {
        found = true;
      }
    } catch {
      // Skip
    }
  }

  // Check all config-like files for the tool name
  if (!found) {
    const configPatterns = ['.json', '.yml', '.yaml', '.toml', '.cfg', '.ini', '.config.ts', '.config.js'];
    for (const fp of allFiles) {
      if (configPatterns.some((p) => fp.endsWith(p))) {
        try {
          const content = readFileSync(fp, 'utf-8');
          if (content.toLowerCase().includes(toolName.toLowerCase())) {
            found = true;
            break;
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  if (!found) {
    evidence.push({
      file: outputDir,
      line: null,
      found: `${toolName} not found in project configuration`,
      expected: `${toolName} present`,
      context: `Instruction references ${toolName}`,
    });
  }

  return {
    rule,
    passed: found,
    compliance: found ? 1 : 0,
    evidence,
  };
}
