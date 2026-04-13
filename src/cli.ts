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
import { handleRun } from './commands/run.js';
import { handleAnalyze } from './commands/analyze.js';

const program = new Command();

program
  .name('ruleprobe')
  .description(
    'Verify whether AI coding agents follow the instruction files they\'re given',
  )
  .version('1.0.0');

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
  .option('--rubric-decompose', 'decompose subjective rules into measurable rubrics via LLM', false)
  .option('--project <tsconfig>', 'tsconfig.json path for type-aware checks')
  .option('--threshold <number>', 'compliance threshold (0-1) for pass/fail', '0.8')
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
        rubricDecompose: boolean;
        project?: string;
        threshold: string;
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

// ── run ──

program
  .command('run')
  .description(
    'Invoke an AI agent on a task template, then verify its output',
  )
  .argument('<instruction-file>', 'path to instruction file')
  .option('--task <template-id>', 'task template to give the agent', 'rest-endpoint')
  .option('--agent <name>', 'agent identifier', 'claude-code')
  .option('--model <name>', 'model to use for the agent', 'sonnet')
  .option('--format <format>', 'report format (text|json|markdown|rdjson)', 'text')
  .option('--output-dir <path>', 'directory to persist agent output')
  .option('--watch <dir>', 'watch a directory for agent output instead of invoking')
  .option('--timeout <seconds>', 'watch mode timeout in seconds', '300')
  .option('--allow-symlinks', 'follow symlinks outside the working directory', false)
  .option('--config <path>', 'path to ruleprobe config file')
  .option('--project <tsconfig>', 'tsconfig.json path for type-aware checks')
  .action(
    async (
      file: string,
      opts: {
        task: string;
        agent: string;
        model: string;
        format: string;
        outputDir?: string;
        watch?: string;
        timeout: string;
        allowSymlinks: boolean;
        config?: string;
        project?: string;
      },
    ) => {
      await handleRun(file, {
        ...opts,
        timeout: parseInt(opts.timeout, 10),
      }, exitWithError);
    },
  );

// ── analyze ──

program
  .command('analyze')
  .description(
    'Discover and analyze all instruction files in a project directory',
  )
  .argument('<project-dir>', 'root directory to scan for instruction files')
  .option('--format <format>', 'output format (text|json)', 'text')
  .option('--output <path>', 'write report to file instead of stdout')
  .action(
    (
      projectDir: string,
      opts: { format: string; output?: string },
    ) => {
      handleAnalyze(projectDir, opts, exitWithError);
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
