/**
 * Handler for the "compare" CLI command.
 *
 * Runs verification against multiple agent outputs and produces
 * a side-by-side comparison report.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionFile } from '../parsers/index.js';
import { verifyOutput } from '../verifier/index.js';
import { generateReport } from '../index.js';
import { formatComparisonMarkdown } from '../reporter/markdown.js';
import { formatTextPlain } from '../reporter/text.js';
import { validateOutputDir, currentTimestamp } from '../runner/index.js';
import { resolveSafePath } from '../utils/safe-path.js';
import type { AgentRun, AdherenceReport } from '../types.js';

/** Options accepted by the compare command. */
export interface CompareOpts {
  agents?: string;
  format: string;
  output?: string;
  allowSymlinks: boolean;
}

/**
 * Execute the compare command.
 *
 * @param file - Path to the instruction file
 * @param dirs - Two or more output directories to compare
 * @param opts - Command options
 * @param exitWithError - Error handler that terminates the process
 */
export function handleCompare(
  file: string,
  dirs: string[],
  opts: CompareOpts,
  exitWithError: (msg: string) => never,
): void {
  let filePath: string;
  try {
    filePath = resolveSafePath(file);
  } catch (err) {
    exitWithError((err as Error).message);
  }

  if (!existsSync(filePath)) {
    exitWithError(`Instruction file not found: ${filePath}`);
  }

  if (dirs.length < 2) {
    exitWithError('Compare requires at least 2 output directories.');
  }

  const validFormats = ['text', 'json', 'markdown'];
  if (!validFormats.includes(opts.format)) {
    exitWithError(
      `Invalid format "${opts.format}". Use one of: ${validFormats.join(', ')}`,
    );
  }

  const agentLabels = opts.agents
    ? opts.agents.split(',').map((s) => s.trim())
    : dirs.map((_, i) => `agent-${i + 1}`);

  if (agentLabels.length !== dirs.length) {
    exitWithError(
      `Number of agent labels (${agentLabels.length}) does not match ` +
      `number of directories (${dirs.length}).`,
    );
  }

  const ruleSet = parseInstructionFile(filePath);
  const reports: AdherenceReport[] = [];

  for (let i = 0; i < dirs.length; i++) {
    let outDir: string;
    try {
      outDir = resolveSafePath(dirs[i]!);
    } catch (err) {
      exitWithError(
        `Directory ${i + 1} (${dirs[i]}): ${(err as Error).message}`,
      );
    }

    try {
      validateOutputDir(outDir);
    } catch (err) {
      exitWithError(
        `Directory ${i + 1} (${dirs[i]}): ${(err as Error).message}`,
      );
    }

    const results = verifyOutput(ruleSet, outDir);
    const run: AgentRun = {
      agent: agentLabels[i]!,
      model: 'unknown',
      taskTemplateId: 'manual',
      outputDir: outDir,
      timestamp: currentTimestamp(),
      durationSeconds: null,
    };

    reports.push(generateReport(run, ruleSet, results));
  }

  let formatted: string;
  if (opts.format === 'markdown') {
    formatted = formatComparisonMarkdown(reports, agentLabels);
  } else if (opts.format === 'json') {
    formatted = JSON.stringify(reports, null, 2);
  } else {
    const parts: string[] = [];
    for (const report of reports) {
      parts.push(formatTextPlain(report));
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    formatted = parts.join('\n');
  }

  if (opts.output) {
    writeFileSync(resolve(opts.output), formatted + '\n', 'utf-8');
    process.stdout.write(`Comparison report written to ${opts.output}\n`);
  } else {
    process.stdout.write(formatted + '\n');
  }
}
