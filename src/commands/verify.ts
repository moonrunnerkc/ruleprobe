/**
 * Handler for the "verify" CLI command.
 *
 * Parses rules from an instruction file, verifies agent output
 * against them, and produces an adherence report.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionFile } from '../parsers/index.js';
import { verifyOutput } from '../verifier/index.js';
import { generateReport } from '../index.js';
import { formatReport } from '../reporter/index.js';
import { validateOutputDir, currentTimestamp } from '../runner/index.js';
import { resolveSafePath } from '../utils/safe-path.js';
import type { AgentRun } from '../types.js';

/** Options accepted by the verify command. */
export interface VerifyOpts {
  agent: string;
  model: string;
  task: string;
  format: string;
  output?: string;
  severity: string;
  allowSymlinks: boolean;
}

/**
 * Execute the verify command.
 *
 * @param file - Path to the instruction file
 * @param outputDir - Directory containing agent output
 * @param opts - Command options
 * @param exitWithError - Error handler that terminates the process
 */
export function handleVerify(
  file: string,
  outputDir: string,
  opts: VerifyOpts,
  exitWithError: (msg: string) => never,
): void {
  let filePath: string;
  let outDir: string;
  try {
    filePath = resolveSafePath(file);
    outDir = resolveSafePath(outputDir);
  } catch (err) {
    exitWithError((err as Error).message);
  }

  if (!existsSync(filePath)) {
    exitWithError(`Instruction file not found: ${filePath}`);
  }

  const validFormats = ['text', 'json', 'markdown'];
  if (!validFormats.includes(opts.format)) {
    exitWithError(
      `Invalid format "${opts.format}". Use one of: ${validFormats.join(', ')}`,
    );
  }

  const validSeverities = ['error', 'warning', 'all'];
  if (!validSeverities.includes(opts.severity)) {
    exitWithError(
      `Invalid severity "${opts.severity}". Use one of: ${validSeverities.join(', ')}`,
    );
  }

  try {
    validateOutputDir(outDir);
  } catch (err) {
    exitWithError((err as Error).message);
  }

  const ruleSet = parseInstructionFile(filePath);
  let results = verifyOutput(ruleSet, outDir);

  if (opts.severity !== 'all') {
    results = results.filter(
      (r) => r.rule.severity === opts.severity || r.passed,
    );
  }

  const run: AgentRun = {
    agent: opts.agent,
    model: opts.model,
    taskTemplateId: opts.task,
    outputDir: outDir,
    timestamp: currentTimestamp(),
    durationSeconds: null,
  };

  const report = generateReport(run, ruleSet, results);
  const formatted = formatReport(
    report,
    opts.format as 'text' | 'json' | 'markdown',
  );

  if (opts.output) {
    writeFileSync(resolve(opts.output), formatted + '\n', 'utf-8');
    process.stdout.write(`Report written to ${opts.output}\n`);
  } else {
    process.stdout.write(formatted + '\n');
  }
}
