/**
 * extract command handler.
 *
 * Parses an ESLint config file and emits a markdown rules section
 * suitable for pasting into a CLAUDE.md or other instruction file.
 * Subjective/stylistic rules without a prose equivalent are emitted
 * as skipped comments.
 */

import { parseEslintConfigAsync } from '../drift/parseEslintConfig.js';
import { extractRules, formatRulesMarkdown } from '../extractor/index.js';
import { resolveSafePath } from '../utils/safe-path.js';
import { writeFileSync } from 'node:fs';

/**
 * Handle the extract command.
 *
 * @param eslintFile - Path to the ESLint config file
 * @param opts - Command options
 * @param opts.output - Optional path to write output to a file
 * @param exitWithError - Callback to exit with an error message
 */
export async function handleExtract(
  eslintFile: string,
  opts: { output?: string },
  exitWithError: (message: string) => never,
): Promise<void> {
  // Resolve and validate input path
  const safeInputPath = resolveSafePath(eslintFile);

  // Parse the ESLint config (async to support JS/TS files)
  let config;
  try {
    config = await parseEslintConfigAsync(safeInputPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(`Failed to parse ESLint config: ${message}`);
  }

  // Extract rules
  const result = extractRules(config);

  // Format as markdown
  const output = formatRulesMarkdown(result);

  // Write to file or stdout
  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }
}