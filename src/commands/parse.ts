/**
 * Handler for the "parse" CLI command.
 *
 * Parses an instruction file and outputs extracted rules
 * in JSON or text format. Optionally runs LLM extraction
 * on unparseable lines.
 */

import { existsSync } from 'node:fs';
import { parseInstructionFile } from '../parsers/index.js';
import { formatParseText } from '../reporter/index.js';
import { resolveSafePath } from '../utils/safe-path.js';
import type { RuleSet } from '../types.js';

/** Options accepted by the parse command. */
export interface ParseOpts {
  format: string;
  showUnparseable: boolean;
  llmExtract?: boolean;
}

/**
 * Execute the parse command.
 *
 * @param file - Path to the instruction file
 * @param opts - Command options (format, showUnparseable, llmExtract)
 * @param exitWithError - Error handler that terminates the process
 */
export async function handleParse(
  file: string,
  opts: ParseOpts,
  exitWithError: (msg: string) => never,
): Promise<void> {
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

  let ruleSet: RuleSet = parseInstructionFile(filePath);

  if (opts.llmExtract) {
    ruleSet = await runLlmExtraction(ruleSet, exitWithError);
  }

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

/**
 * Run LLM extraction on unparseable lines.
 * Lazily imports the LLM module to avoid loading it when not needed.
 */
async function runLlmExtraction(
  ruleSet: RuleSet,
  exitWithError: (msg: string) => never,
): Promise<RuleSet> {
  try {
    const { extractWithLlm, createOpenAiProvider } = await import('../llm/index.js');
    const provider = createOpenAiProvider();
    return await extractWithLlm(ruleSet, { provider });
  } catch (err) {
    exitWithError(`LLM extraction failed: ${(err as Error).message}`);
  }
}
