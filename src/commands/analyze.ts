/**
 * Handler for the `ruleprobe analyze` command.
 *
 * Discovers all instruction files in a project directory,
 * parses each, detects conflicts and redundancies, and
 * outputs a project-level analysis.
 */

import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { analyzeProject } from '../analyzers/project-analyzer.js';
import type { ProjectAnalysis } from '../types.js';

/** Options for the analyze command. */
interface AnalyzeOptions {
  format: string;
  output?: string;
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
 * @param projectDir - Root directory to scan for instruction files
 * @param opts - Command options
 * @param onError - Error handler callback
 */
export function handleAnalyze(
  projectDir: string,
  opts: AnalyzeOptions,
  onError: (message: string) => never,
): void {
  const resolvedDir = resolve(projectDir);
  if (!existsSync(resolvedDir)) {
    onError(`Directory not found: ${resolvedDir}`);
  }

  const analysis = analyzeProject(resolvedDir);

  let output: string;
  if (opts.format === 'json') {
    output = formatJson(analysis);
  } else {
    output = formatText(analysis);
  }

  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }
}
