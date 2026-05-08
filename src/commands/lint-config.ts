/**
 * lint-config command handler.
 *
 * Parses an instruction file and emits a corresponding ESLint
 * configuration. Supports flat config (default) and legacy
 * .eslintrc format via --format.
 */

import { parseInstructionFile } from '../parsers/index.js';
import { mapRuleSetToEslintConfig } from '../mapper/index.js';
import { emitEslintConfig } from '../emitter/eslint.js';
import type { EslintFormat } from '../mapper/types.js';
import { writeFileSync } from 'node:fs';

/**
 * Handle the lint-config command.
 *
 * @param filePath - Path to the instruction file
 * @param opts - Command options
 * @param opts.format - Output format: 'flat' or 'legacy'
 * @param opts.output - Optional path to write output to a file
 * @param exitWithError - Callback to exit with an error message
 */
export async function handleLintConfig(
  filePath: string,
  opts: { format: string; output?: string },
  exitWithError: (message: string) => never,
): Promise<void> {
  const format: EslintFormat = opts.format === 'legacy' ? 'legacy' : 'flat';

  // Parse the instruction file
  let ruleSet;
  try {
    ruleSet = parseInstructionFile(filePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(`Failed to parse instruction file: ${message}`);
  }

  // Map rules to ESLint config
  const eslintConfig = mapRuleSetToEslintConfig(ruleSet);

  // Emit the config
  const output = emitEslintConfig(eslintConfig, format);

  // Write to file or stdout
  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }
}