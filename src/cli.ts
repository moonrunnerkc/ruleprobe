#!/usr/bin/env node
/**
 * RuleProbe CLI.
 *
 * Commands: parse, verify, tasks, task, compare.
 * Uses commander for argument parsing. Handles errors cleanly
 * with actionable messages instead of stack traces.
 */

import { Command } from 'commander';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionFile } from './parsers/index.js';
import { verifyOutput } from './verifier/index.js';
import { generateReport } from './index.js';
import { formatReport, formatParseText } from './reporter/index.js';
import { formatComparisonMarkdown } from './reporter/markdown.js';
import { formatTextPlain } from './reporter/text.js';
import { formatJson } from './reporter/json.js';
import { validateOutputDir, currentTimestamp } from './runner/index.js';
import {
  listTaskTemplates,
  findTaskTemplate,
  loadTaskPrompt,
} from './runner/task-templates.js';
import type { AgentRun, AdherenceReport } from './types.js';

const program = new Command();

program
  .name('ruleprobe')
  .description(
    'Verify whether AI coding agents follow the instruction files they\'re given',
  )
  .version('0.1.0');

// ── parse ──────────────────────────────────────────────────────

program
  .command('parse')
  .description('Parse an instruction file and output extracted rules')
  .argument('<instruction-file>', 'path to instruction file')
  .option('--format <format>', 'output format (json|text)', 'text')
  .option('--show-unparseable', 'include lines that could not be extracted', false)
  .action((file: string, opts: { format: string; showUnparseable: boolean }) => {
    const filePath = resolve(file);

    if (!existsSync(filePath)) {
      exitWithError(`File not found: ${filePath}`);
    }

    const validFormats = ['json', 'text'];
    if (!validFormats.includes(opts.format)) {
      exitWithError(
        `Invalid format "${opts.format}". Use one of: ${validFormats.join(', ')}`,
      );
    }

    const ruleSet = parseInstructionFile(filePath);

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
  });

// ── verify ─────────────────────────────────────────────────────

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
  .option('--format <format>', 'report format (text|json|markdown)', 'text')
  .option('--output <path>', 'write report to file instead of stdout')
  .option(
    '--severity <level>',
    'filter results by severity (error|warning|all)',
    'all',
  )
  .action(
    (
      file: string,
      outputDir: string,
      opts: {
        agent: string;
        model: string;
        task: string;
        format: string;
        output?: string;
        severity: string;
      },
    ) => {
      const filePath = resolve(file);
      const outDir = resolve(outputDir);

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

      // Filter by severity if specified
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
    },
  );

// ── tasks ──────────────────────────────────────────────────────

program
  .command('tasks')
  .description('List available task templates')
  .action(() => {
    const templates = listTaskTemplates();

    if (templates.length === 0) {
      process.stdout.write('No task templates available.\n');
      return;
    }

    process.stdout.write('Available task templates:\n\n');
    for (const t of templates) {
      process.stdout.write(`  ${t.id}\n`);
      process.stdout.write(`    ${t.name}\n`);
      process.stdout.write(`    ${t.description}\n`);
      process.stdout.write(
        `    Exercises: ${t.exercises.join(', ')}\n`,
      );
      process.stdout.write('\n');
    }
  });

// ── task ───────────────────────────────────────────────────────

program
  .command('task')
  .description('Output the full task prompt for a given template')
  .argument('<template-id>', 'task template identifier')
  .action((templateId: string) => {
    const template = findTaskTemplate(templateId);

    if (!template) {
      const available = listTaskTemplates()
        .map((t) => t.id)
        .join(', ');
      exitWithError(
        `Unknown task template: "${templateId}"\n` +
        `Available templates: ${available}`,
      );
    }

    const prompt = loadTaskPrompt(templateId);

    if (prompt === null) {
      process.stdout.write(
        `Task template "${templateId}" is registered but the prompt file ` +
        'is not yet available.\n' +
        'Task template prompts will be added in Phase 4.\n',
      );
      process.stdout.write(`\nTemplate info:\n`);
      process.stdout.write(`  Name: ${template.name}\n`);
      process.stdout.write(`  Description: ${template.description}\n`);
      process.stdout.write(
        `  Exercises: ${template.exercises.join(', ')}\n`,
      );
      return;
    }

    process.stdout.write(prompt);
  });

// ── compare ────────────────────────────────────────────────────

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
  .action(
    (
      file: string,
      dirs: string[],
      opts: { agents?: string; format: string; output?: string },
    ) => {
      const filePath = resolve(file);

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
        const outDir = resolve(dirs[i]!);

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
        // Text: print each report sequentially
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
    },
  );

// ── Error handling ─────────────────────────────────────────────

/**
 * Print an error message and exit with code 1.
 * Avoids stack traces; prints actionable messages only.
 */
function exitWithError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

// Parse and execute
program.parse();
