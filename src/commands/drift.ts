/**
 * drift command handler.
 *
 * Compares a CLAUDE.md instruction file against an existing ESLint
 * config file and reports drift between them. Reports mismatches in
 * both directions: rules in md but not in eslint, rules in eslint
 * but not in md, severity mismatches, and config-arg mismatches.
 *
 * Exit codes: 0 = no drift, 1 = drift found, 2 = execution error.
 */

import { discoverInstructionFiles } from '../parsers/discover-instructions.js';
import { parseInstructionFile } from '../parsers/index.js';
import { mapRuleSetToEslintConfig } from '../mapper/index.js';
import { resolveEslintConfigs } from '../drift/resolve-eslint-config.js';
import { compareInstructionConfigs } from '../drift/compare-configs.js';
import { formatDriftReport } from '../drift/format-drift-report.js';
import { resolveSafePath } from '../utils/safe-path.js';
import type { DriftFormat } from '../drift/types.js';
import { statSync, writeFileSync } from 'node:fs';

/**
 * Handle the drift command.
 *
 * @param mdFile - Path to the instruction file (CLAUDE.md, AGENTS.md, etc.)
 * @param eslintFile - Path to the ESLint config file
 * @param opts - Command options
 * @param opts.format - Output format: 'text', 'json', or 'markdown'
 * @param opts.output - Optional path to write output to a file
 * @param exitWithError - Callback to exit with an error message
 */
export async function handleDrift(
  mdFile: string,
  eslintFile: string,
  opts: { format: string; output?: string; configJson?: boolean; files?: string[] },
  exitWithError: (message: string) => never,
): Promise<void> {
  const format: DriftFormat = opts.format === 'json' ? 'json' : opts.format === 'markdown' ? 'markdown' : 'text';

  // Resolve and validate input paths
  const safeInputPath = resolveSafePath(mdFile);
  const safeEslintPath = resolveSafePath(eslintFile);

  // Parse the instruction file into rules
  let ruleSets;
  try {
    const paths = statSync(safeInputPath).isDirectory() ? discoverInstructionFiles(safeInputPath) : [safeInputPath];
    ruleSets = paths.map(path => parseInstructionFile(path));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(`Failed to parse instruction file: ${message}`);
  }

  // Map rules to ESLint config
  const mdConfigs = ruleSets.map(ruleSet => mapRuleSetToEslintConfig(ruleSet));

  // Parse the existing ESLint config (async to support JS/TS files)
  let fileConfig;
  try {
    fileConfig = await resolveEslintConfigs(safeEslintPath, opts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(`Failed to parse ESLint config: ${message}`);
  }

  // Compare
  const result = compareInstructionConfigs(mdConfigs, fileConfig, safeEslintPath, safeInputPath);

  // Format and output
  const output = formatDriftReport(result, format);

  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }

  // Exit code: 0 no drift, 1 drift, 2 error (handled by exitWithError)
  if (result.hasDrift || result.comparisonStatus !== 'compared') {
    process.exitCode = 1;
  }
}