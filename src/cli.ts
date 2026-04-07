#!/usr/bin/env node
/**
 * RuleProbe CLI.
 *
 * Command registration and top-level wiring. Each command delegates
 * to a handler in src/commands/. Handles errors cleanly with
 * actionable messages instead of stack traces.
 */

import { Command } from 'commander';
import { handleParse } from './commands/parse.js';
import { handleVerify } from './commands/verify.js';
import { handleCompare } from './commands/compare.js';
import { handleTasks, handleTask } from './commands/tasks.js';

const program = new Command();

program
  .name('ruleprobe')
  .description(
    'Verify whether AI coding agents follow the instruction files they\'re given',
  )
  .version('0.1.0');

// ── parse ──

program
  .command('parse')
  .description('Parse an instruction file and output extracted rules')
  .argument('<instruction-file>', 'path to instruction file')
  .option('--format <format>', 'output format (json|text)', 'text')
  .option('--show-unparseable', 'include lines that could not be extracted', false)
  .option('--llm-extract', 'use LLM to extract rules from unparseable lines', false)
  .action(async (file: string, opts: { format: string; showUnparseable: boolean; llmExtract: boolean }) => {
    await handleParse(file, opts, exitWithError);
  });

// ── verify ──

program
  .command('verify')
  .description(
    'Parse rules from instruction file, verify agent output against them',
  )
  .argument('<instruction-file>', 'path to instruction file')
  .argument('<output-dir>', 'directory containing agent output')
  .option('--agent <name>', 'agent identifier for report metadata', 'unknown')
  .option('--model <name>', 'model identifier for report metadata', 'unknown')
  .option('--task <template-id>', 'which task template was used', 'manual')
  .option('--format <format>', 'report format (text|json|markdown|rdjson)', 'text')
  .option('--output <path>', 'write report to file instead of stdout')
  .option(
    '--severity <level>',
    'filter results by severity (error|warning|all)',
    'all',
  )
  .option('--allow-symlinks', 'follow symlinks outside the working directory', false)
  .option('--config <path>', 'path to ruleprobe config file')
  .option('--llm-extract', 'use LLM to extract rules from unparseable lines', false)
  .action(
    async (
      file: string,
      outputDir: string,
      opts: {
        agent: string;
        model: string;
        task: string;
        format: string;
        output?: string;
        severity: string;
        allowSymlinks: boolean;
        config?: string;
        llmExtract: boolean;
      },
    ) => {
      await handleVerify(file, outputDir, opts, exitWithError);
    },
  );

// ── tasks ──

program
  .command('tasks')
  .description('List available task templates')
  .action(() => {
    handleTasks();
  });

// ── task ──

program
  .command('task')
  .description('Output the full task prompt for a given template')
  .argument('<template-id>', 'task template identifier')
  .action((templateId: string) => {
    handleTask(templateId, exitWithError);
  });

// ── compare ──

program
  .command('compare')
  .description(
    'Run verification against multiple agent outputs and produce a comparison',
  )
  .argument('<instruction-file>', 'path to instruction file')
  .argument('<dirs...>', 'two or more output directories to compare')
  .option(
    '--agents <names>',
    'comma-separated labels for each directory',
  )
  .option('--format <format>', 'report format (text|json|markdown)', 'markdown')
  .option('--output <path>', 'write report to file instead of stdout')
  .option('--allow-symlinks', 'follow symlinks outside the working directory', false)
  .option('--config <path>', 'path to ruleprobe config file')
  .action(
    async (
      file: string,
      dirs: string[],
      opts: { agents?: string; format: string; output?: string; allowSymlinks: boolean; config?: string },
    ) => {
      await handleCompare(file, dirs, opts, exitWithError);
    },
  );

// ── Error handling ──

/**
 * Print an error message and exit with code 2 (execution error).
 * Avoids stack traces; prints actionable messages only.
 */
function exitWithError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(2);
}

program.parse();
