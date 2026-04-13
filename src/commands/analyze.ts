/**
 * Handler for the `ruleprobe analyze` command.
 *
 * Discovers all instruction files in a project directory,
 * parses each, detects conflicts and redundancies, and
 * outputs a project-level analysis. Optionally runs semantic
 * analysis via the paid API tier when --semantic is passed.
 */

import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { analyzeProject } from '../analyzers/project-analyzer.js';
import type { ProjectAnalysis, Rule } from '../types.js';
import { resolveSemanticConfig } from '../semantic/config.js';
import type { SemanticCliOptions } from '../semantic/config.js';
import {
  analyzeProjectSemantic,
  integrateSemanticResults,
} from '../semantic/index.js';
import type { SemanticPipelineResult } from '../semantic/index.js';
import { writeAuditLog, formatAuditLog } from '../semantic/audit-log.js';
import type { SemanticAnalysisReport } from '../semantic/types.js';

/** Options for the analyze command. */
export interface AnalyzeOptions {
  format: string;
  output?: string;
  semantic?: boolean;
  licenseKey?: string;
  maxLlmCalls?: string;
  cache?: boolean;
  semanticLog?: boolean;
  costReport?: boolean;
}

/**
 * Format project analysis as JSON.
 */
function formatJson(analysis: ProjectAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Format project analysis as human-readable text.
 */
function formatText(analysis: ProjectAnalysis): string {
  const lines: string[] = [];

  lines.push(chalk.bold('Project Analysis'));
  lines.push(`Directory: ${analysis.projectDir}`);
  lines.push(`Instruction files found: ${analysis.files.length}`);
  lines.push('');

  for (const file of analysis.files) {
    lines.push(chalk.cyan(`  ${file.filePath}`));
    lines.push(`    Type: ${file.fileType}`);
    lines.push(`    Rules: ${file.ruleSet.rules.length}`);
    lines.push(`    Unparseable: ${file.ruleSet.unparseable.length}`);
  }

  if (analysis.files.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Rule Coverage by Category'));
    for (const [category, files] of Object.entries(analysis.coverageMap)) {
      lines.push(`  ${category}: ${files.length} file(s)`);
    }
  }

  if (analysis.conflicts.length > 0) {
    lines.push('');
    lines.push(chalk.bold.red(`Conflicts: ${analysis.conflicts.length}`));
    for (const conflict of analysis.conflicts) {
      lines.push(`  ${chalk.yellow(conflict.topic)}: ${conflict.description}`);
    }
  }

  if (analysis.redundancies.length > 0) {
    lines.push('');
    lines.push(chalk.bold.yellow(`Redundancies: ${analysis.redundancies.length}`));
    for (const r of analysis.redundancies) {
      const files = r.occurrences.map((o) => o.file).join(', ');
      lines.push(`  "${r.normalizedText}" appears in: ${files}`);
    }
  }

  lines.push('');
  lines.push(`Total rules across all files: ${analysis.summary.totalRules}`);

  return lines.join('\n');
}

/**
 * Handle the analyze command.
 *
 * Runs deterministic analysis first, then optionally runs
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
  let semanticResult: SemanticPipelineResult | undefined;

  if (opts.semantic) {
    const cliOptions: SemanticCliOptions = {
      licenseKey: opts.licenseKey,
      maxLlmCalls: opts.maxLlmCalls !== undefined ? parseInt(opts.maxLlmCalls, 10) : undefined,
      noCache: opts.cache === false,
      semanticLog: opts.semanticLog,
      costReport: opts.costReport,
    };

    const config = resolveSemanticConfig(resolvedDir, cliOptions);
    if (config === null) {
      process.stderr.write(
        'Semantic analysis requires a license key. ' +
        'Set --license-key, RULEPROBE_LICENSE_KEY env var, or .ruleprobe/config.json.\n',
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
  if (opts.format === 'json') {
    output = formatJson(analysis);
  } else {
    output = formatText(analysis);
  }

  if (opts.semantic && semanticResult?.performed) {
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
}

/**
 * Format a brief semantic analysis summary for text output.
 */
function formatSemanticSummary(result: SemanticPipelineResult): string {
  if (!result.performed) {
    return '';
  }
  const lines = [
    '',
    chalk.bold('Semantic Analysis'),
    `  Verdicts: ${result.verdicts.length}`,
  ];
  if (result.report) {
    lines.push(`  Fast-path: ${result.report.fastPathResolutions}`);
    lines.push(`  LLM-assisted: ${result.report.llmResolutions}`);
    lines.push(`  Token cost: ${result.report.totalTokenCost}`);
  }
  return lines.join('\n');
}

/**
 * Format a cost breakdown report for the --cost-report flag.
 */
function formatCostReport(report: SemanticAnalysisReport): string {
  const total = report.fastPathResolutions + report.llmResolutions;
  const fastPct = total > 0 ? ((report.fastPathResolutions / total) * 100).toFixed(1) : '0.0';
  const llmPct = total > 0 ? ((report.llmResolutions / total) * 100).toFixed(1) : '0.0';

  return [
    chalk.bold('Cost Report'),
    `  Rules analyzed: ${report.rulesAnalyzed}`,
    `  Fast-path resolutions: ${report.fastPathResolutions} (${fastPct}%)`,
    `  LLM resolutions: ${report.llmResolutions} (${llmPct}%)`,
    `  Total token cost: ${report.totalTokenCost}`,
    `  Profile cache hit: ${report.profileCacheHit ? 'yes' : 'no'}`,
  ].join('\n');
}
