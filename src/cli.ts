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
import { handleAnalyze } from './commands/analyze.js';
import { handleLintConfig } from './commands/lint-config.js';
import { handleDrift } from './commands/drift.js';
import { handleExtract } from './commands/extract.js';

const program = new Command();

program
  .name('ruleprobe')
  .description(
    'Translate instruction files into ESLint configs, detect drift, and extract rules',
  )
  .version('4.5.0');

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

// ── analyze ──

program
  .command('analyze')
  .description(
    'Discover and analyze all instruction files in a project directory',
  )
  .argument('<project-dir>', 'root directory to scan for instruction files')
  .option('--format <format>', 'output format (text|json)', 'text')
  .option('--output <path>', 'write report to file instead of stdout')
  .option('--semantic', 'enable semantic analysis (requires ANTHROPIC_API_KEY)', false)
  .option('--anthropic-key <key>', 'Anthropic API key for semantic analysis')
  .option('--max-llm-calls <n>', 'maximum LLM calls per analysis (default: 20)')
  .option('--no-cache', 'disable profile caching')
  .option('--semantic-log', 'print semantic analysis log to stdout after results', false)
  .option('--cost-report', 'show estimated cost breakdown for semantic analysis', false)
  .option('--threshold <number>', 'compliance threshold (0-1) for CI pass/fail', '0.8')
  .action(
    async (
      projectDir: string,
      opts: {
        format: string;
        output?: string;
        semantic: boolean;
        anthropicKey?: string;
        maxLlmCalls?: string;
        cache: boolean;
        semanticLog: boolean;
        costReport: boolean;
        threshold?: string;
      },
    ) => {
      await handleAnalyze(projectDir, opts, exitWithError);
    },
  );

// ── lint-config ──

program
  .command('lint-config')
  .description(
    'Parse an instruction file and emit an ESLint config',
  )
  .argument('<instruction-file>', 'path to instruction file')
  .option('--format <format>', 'output format (flat|legacy)', 'flat')
  .option('--output <path>', 'write config to file instead of stdout')
  .action(async (file: string, opts: { format: string; output?: string }) => {
    await handleLintConfig(file, opts, exitWithError);
  });

// ── drift ──

program
  .command('drift')
  .description(
    'Detect drift between a CLAUDE.md instruction file and an ESLint config',
  )
  .argument('<md-file>', 'path to instruction file')
  .argument('<eslint-file>', 'path to ESLint config file')
  .option('--format <format>', 'output format (text|json|markdown)', 'text')
  .option('--output <path>', 'write report to file instead of stdout')
  .action(async (mdFile: string, eslintFile: string, opts: { format: string; output?: string }) => {
    await handleDrift(mdFile, eslintFile, opts, exitWithError);
  });

// ── extract ──

program
  .command('extract')
  .description(
    'Extract a rules section from an ESLint config file',
  )
  .argument('<eslint-file>', 'path to ESLint config file')
  .option('--output <path>', 'write output to file instead of stdout')
  .action(async (eslintFile: string, opts: { output?: string }) => {
    await handleExtract(eslintFile, opts, exitWithError);
  });

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
