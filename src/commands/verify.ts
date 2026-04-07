/**
 * Handler for the "verify" CLI command.
 *
 * Parses rules from an instruction file, verifies agent output
 * against them, and produces an adherence report. Returns a
 * meaningful exit code: 0 (all pass), 1 (violations), 2 (error).
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionFile } from '../parsers/index.js';
import { verifyOutput } from '../verifier/index.js';
import { generateReport } from '../index.js';
import { formatReport } from '../reporter/index.js';
import { validateOutputDir, currentTimestamp } from '../runner/index.js';
import { resolveSafePath } from '../utils/safe-path.js';
import { loadConfig, applyConfig } from '../config/index.js';
import type { AgentRun, ReportFormat, RuleSet } from '../types.js';

/** Options accepted by the verify command. */
export interface VerifyOpts {
  agent: string;
  model: string;
  task: string;
  format: string;
  output?: string;
  severity: string;
  allowSymlinks: boolean;
  config?: string;
  llmExtract?: boolean;
}

/**
 * Exit code constants for the verify command.
 *
 * 0: all rules passed
 * 1: one or more rule violations found
 * 2: execution error (file not found, parse failure, etc)
 */
export const EXIT_ALL_PASSED = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_ERROR = 2;

/**
 * Execute the verify command.
 *
 * @param file - Path to the instruction file
 * @param outputDir - Directory containing agent output
 * @param opts - Command options
 * @param exitWithError - Error handler that terminates the process
 */
export async function handleVerify(
  file: string,
  outputDir: string,
  opts: VerifyOpts,
  exitWithError: (msg: string) => never,
): Promise<void> {
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

  const validFormats: ReportFormat[] = ['text', 'json', 'markdown', 'rdjson'];
  if (!validFormats.includes(opts.format as ReportFormat)) {
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

  let effectiveRuleSet: RuleSet = ruleSet;
  try {
    const config = await loadConfig(opts.config, outDir);
    if (config) {
      effectiveRuleSet = applyConfig(ruleSet, config);
    }
  } catch (err) {
    exitWithError(`Config error: ${(err as Error).message}`);
  }

  if (opts.llmExtract) {
    try {
      const { extractWithLlm, createOpenAiProvider } = await import('../llm/index.js');
      const provider = createOpenAiProvider();
      effectiveRuleSet = await extractWithLlm(effectiveRuleSet, { provider });
    } catch (err) {
      exitWithError(`LLM extraction failed: ${(err as Error).message}`);
    }
  }

  let results = verifyOutput(effectiveRuleSet, outDir, { allowSymlinks: opts.allowSymlinks });

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
    opts.format as ReportFormat,
  );

  if (opts.output) {
    writeFileSync(resolve(opts.output), formatted + '\n', 'utf-8');
    process.stdout.write(`Report written to ${opts.output}\n`);
  } else {
    process.stdout.write(formatted + '\n');
  }

  const hasViolations = report.summary.failed > 0;
  process.exit(hasViolations ? EXIT_VIOLATIONS : EXIT_ALL_PASSED);
}
