/**
 * Handler for the `ruleprobe analyze` command.
 *
 * Discovers all instruction files in a project directory,
 * parses each, detects conflicts and redundancies, and
 * outputs a project-level analysis. Optionally runs semantic
 * analysis when --semantic is passed with an Anthropic API key.
 */

import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { analyzeProject } from '../analyzers/project-analyzer.js';
import type { ProjectAnalysis, Rule } from '../types.js';
import { DEFAULT_COMPLIANCE_THRESHOLD } from '../types.js';
import { verifyOutput } from '../verifier/index.js';
import { resolveSemanticConfig } from '../semantic/config.js';
import type { SemanticCliOptions } from '../semantic/config.js';
import {
  analyzeProjectSemantic,
  integrateSemanticResults,
} from '../semantic/index.js';
import type { SemanticPipelineResult } from '../semantic/index.js';
import { writeAuditLog, formatAuditLog } from '../semantic/audit-log.js';
import {
  computeSummary,
  computeOverallCompliance,
  formatJson,
  formatText,
  formatDetailed,
  formatSummary,
  formatCi,
  formatSemanticSummary,
  formatCostReport,
} from './analyze-formatters.js';

/** Options for the analyze command. */
export interface AnalyzeOptions {
  format: string;
  output?: string;
  semantic?: boolean;
  anthropicKey?: string;
  maxLlmCalls?: string;
  cache?: boolean;
  semanticLog?: boolean;
  costReport?: boolean;
  threshold?: string;
}

/**
 * Handle the analyze command.
 *
 * Runs deterministic analysis and verification first, then optionally runs
 * semantic analysis when the --semantic flag is passed.
 *
 * @param projectDir - Root directory to scan for instruction files
 * @param opts - Command options
 * @param onError - Error handler callback
 */
export async function handleAnalyze(
  projectDir: string,
  opts: AnalyzeOptions,
  onError: (message: string) => never,
): Promise<void> {
  const resolvedDir = resolve(projectDir);
  if (!existsSync(resolvedDir)) {
    onError(`Directory not found: ${resolvedDir}`);
  }

  let analysis: ProjectAnalysis = analyzeProject(resolvedDir);

  // Run verification for each file's rules against the project directory
  for (const fileAnalysis of analysis.files) {
    const results = await verifyOutput(fileAnalysis.ruleSet, resolvedDir);
    fileAnalysis.results = results;
  }

  // Recompute summary from actual verification results
  analysis.summary = computeSummary(analysis);

  let semanticResult: SemanticPipelineResult | undefined;

  if (opts.semantic) {
    const cliOptions: SemanticCliOptions = {
      anthropicKey: opts.anthropicKey,
      maxLlmCalls: opts.maxLlmCalls !== undefined ? parseInt(opts.maxLlmCalls, 10) : undefined,
      noCache: opts.cache === false,
      semanticLog: opts.semanticLog,
      costReport: opts.costReport,
    };

    const config = resolveSemanticConfig(resolvedDir, cliOptions);
    if (config === null) {
      process.stderr.write(
        'Semantic analysis requires an Anthropic API key. ' +
        'Set --anthropic-key, ANTHROPIC_API_KEY env var, or .ruleprobe/config.json.\n',
      );
    } else {
      const allRules: Rule[] = analysis.files.flatMap((f) => f.ruleSet.rules);
      semanticResult = await analyzeProjectSemantic(resolvedDir, config, allRules);
      analysis = integrateSemanticResults(analysis, semanticResult);

      if (!semanticResult.performed && semanticResult.skipReason) {
        process.stderr.write(`Semantic analysis skipped: ${semanticResult.skipReason}\n`);
      }
    }
  }

  let output: string;
  const threshold = opts.threshold ? parseFloat(opts.threshold) : DEFAULT_COMPLIANCE_THRESHOLD;

  switch (opts.format) {
    case 'json':
      output = formatJson(analysis);
      break;
    case 'detailed':
      output = formatDetailed(analysis);
      break;
    case 'summary':
      output = formatSummary(analysis);
      break;
    case 'ci':
      output = formatCi(analysis);
      break;
    default:
      output = formatText(analysis);
      break;
  }

  if (opts.semantic && semanticResult?.performed && opts.format !== 'json') {
    output += formatSemanticSummary(semanticResult);
  }

  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }

  if (opts.semanticLog && semanticResult) {
    const logPath = writeAuditLog(resolvedDir, semanticResult);
    process.stdout.write(formatAuditLog(semanticResult) + '\n');
    process.stdout.write(`Audit log written to: ${logPath}\n`);
  }

  if (opts.costReport && semanticResult?.report) {
    process.stdout.write(formatCostReport(semanticResult.report) + '\n');
  }

  // CI exit code: non-zero if overall compliance is below threshold
  if (opts.format === 'ci') {
    const overallCompliance = computeOverallCompliance(analysis);
    if (overallCompliance < threshold) {
      process.exit(1);
    }
  }
}
