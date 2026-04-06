/**
 * Handler for the "parse" CLI command.
 *
 * Parses an instruction file and outputs extracted rules
 * in JSON or text format.
 */

import { existsSync } from 'node:fs';
import { parseInstructionFile } from '../parsers/index.js';
import { formatParseText } from '../reporter/index.js';
import { resolveSafePath } from '../utils/safe-path.js';

/**
 * Execute the parse command.
 *
 * @param file - Path to the instruction file
 * @param opts - Command options (format, showUnparseable)
 * @param exitWithError - Error handler that terminates the process
 */
export function handleParse(
  file: string,
  opts: { format: string; showUnparseable: boolean },
  exitWithError: (msg: string) => never,
): void {
  let filePath: string;
  try {
    filePath = resolveSafePath(file);
  } catch (err) {
    exitWithError((err as Error).message);
  }

  if (!existsSync(filePath)) {
    exitWithError(`File not found: ${filePath}`);
  }

  const validFormats = ['json', 'text'];
  if (!validFormats.includes(opts.format)) {
    exitWithError(
      `Invalid format "${opts.format}". Use one of: ${validFormats.join(', ')}`,
    );
  }

  const ruleSet = parseInstructionFile(filePath);

  if (opts.format === 'json') {
    const output: Record<string, unknown> = {
      sourceFile: ruleSet.sourceFile,
      sourceType: ruleSet.sourceType,
      rules: ruleSet.rules,
    };
    if (opts.showUnparseable) {
      output['unparseable'] = ruleSet.unparseable;
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else {
    const text = formatParseText(
      ruleSet.rules,
      ruleSet.unparseable,
      opts.showUnparseable,
    );
    process.stdout.write(text + '\n');
  }
}
