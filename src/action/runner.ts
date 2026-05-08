/**
 * Action runner: orchestrates the GitHub Action logic.
 *
 * Reads inputs, decides whether to run drift detection based on
 * changed files, executes the appropriate ruleprobe command,
 * posts PR comments, and optionally opens a regeneration PR.
 * All I/O is injected via ActionDeps for testability.
 */

import { shouldRunDrift, autoDetectEslintFile } from './detect-changes.js';
import { formatDriftComment, formatDriftSummary } from './comment.js';
import { branchNameFor, commitMessageFor, prTitleFor } from './regenerate.js';
import type { DriftResult } from '../drift/types.js';
import type { ActionInputs, ActionDeps, GitHubContext } from './types.js';

/**
 * Run the full action logic.
 *
 * @param inputs - Action inputs parsed from env vars
 * @param context - GitHub context for the current run
 * @param deps - Injectable dependencies for I/O operations
 */
export async function runAction(
  inputs: ActionInputs,
  context: GitHubContext,
  deps: ActionDeps,
): Promise<void> {
  if (inputs.mode === 'verify') {
    await runVerify(inputs, context, deps);
    return;
  }

  await runDrift(inputs, context, deps);
}

/** Run drift detection mode. */
async function runDrift(
  inputs: ActionInputs,
  context: GitHubContext,
  deps: ActionDeps,
): Promise<void> {
  // Get changed files from the PR
  const changedFiles = await deps.getChangedFiles(context);

  // Determine the eslint config file
  const eslintFile = inputs.eslintFile
    ?? autoDetectEslintFile(changedFiles)
    ?? findEslintFileInWorkspace(deps, context.workspace);

  if (!eslintFile) {
    deps.setFailed('No ESLint config file found. Specify one with the eslint-file input.');
    return;
  }

  // Check if any relevant files changed
  if (!shouldRunDrift(changedFiles, { instructionFile: inputs.instructionFile, eslintFile })) {
    deps.info('No relevant files changed, skipping drift detection.');
    deps.setOutput('drift-count', '0');
    deps.setOutput('has-drift', 'false');
    return;
  }

  deps.info(`Running drift detection: ${inputs.instructionFile} vs ${eslintFile}`);

  // Run ruleprobe drift
  const driftExitCode = await deps.runCommand('ruleprobe', [
    'drift',
    inputs.instructionFile,
    eslintFile,
    '--format', 'json',
    '--output', `${context.workspace}/.ruleprobe-drift.json`,
  ]);

  if (driftExitCode === 2) {
    deps.setFailed('Drift detection failed with an execution error.');
    return;
  }

  // Read the JSON result
  const driftJson = await deps.readFile(`${context.workspace}/.ruleprobe-drift.json`);
  let result: DriftResult;
  try {
    result = JSON.parse(driftJson) as DriftResult;
  } catch {
    deps.setFailed('Failed to parse drift detection output.');
    return;
  }

  // Also run text format for the log
  await deps.runCommand('ruleprobe', [
    'drift',
    inputs.instructionFile,
    eslintFile,
    '--format', 'text',
  ]);

  // Set outputs
  const driftCount = result.items.length;
  deps.setOutput('drift-count', String(driftCount));
  deps.setOutput('has-drift', String(result.hasDrift));

  deps.info(formatDriftSummary(driftCount));

  // Post PR comment
  if (inputs.commentOnPr && context.prNumber) {
    const commentBody = formatDriftComment(result);
    await deps.postComment(context, context.prNumber, commentBody, 'ruleprobe-drift');
  }

  // Fail if drift detected and failOnDrift is true
  if (result.hasDrift && inputs.failOnDrift) {
    deps.setFailed(`${driftCount} drift issue(s) detected.`);
    return;
  }

  // Regenerate if requested and drift detected
  if (inputs.regenerateOnDrift && result.hasDrift && context.prNumber) {
    await regenerateConfig(inputs, context, deps, eslintFile);
  }
}

/** Run verification mode (legacy). */
async function runVerify(
  inputs: ActionInputs,
  context: GitHubContext,
  deps: ActionDeps,
): Promise<void> {
  const outputDir = inputs.outputDir ?? 'src';

  // Run the text report
  const textExitCode = await deps.runCommand('ruleprobe', [
    'verify',
    inputs.instructionFile,
    outputDir,
    '--agent', inputs.agent ?? 'ci',
    '--model', inputs.model ?? 'unknown',
    '--severity', inputs.severity ?? 'all',
    '--format', 'text',
    '--output', `${context.workspace}/.ruleprobe-report.txt`,
  ]);

  // Run the JSON report for programmatic consumption
  await deps.runCommand('ruleprobe', [
    'verify',
    inputs.instructionFile,
    outputDir,
    '--agent', inputs.agent ?? 'ci',
    '--model', inputs.model ?? 'unknown',
    '--severity', inputs.severity ?? 'all',
    '--format', 'json',
    '--output', `${context.workspace}/.ruleprobe-report.json`,
  ]);

  // Read JSON report for outputs
  const jsonReport = await deps.readFile(`${context.workspace}/.ruleprobe-report.json`);
  const report = JSON.parse(jsonReport) as {
    summary: { adherenceScore: number; passed: number; failed: number; totalRules: number };
  };

  deps.setOutput('score', String(Math.round(report.summary.adherenceScore)));
  deps.setOutput('passed', String(report.summary.passed));
  deps.setOutput('failed', String(report.summary.failed));
  deps.setOutput('total', String(report.summary.totalRules));

  if (textExitCode === 1 && inputs.failOnViolation) {
    deps.setFailed(`RuleProbe found ${report.summary.failed} rule violation(s).`);
  }
}

/** Find an eslint config file in the workspace by scanning. */
function findEslintFileInWorkspace(deps: ActionDeps, workspace: string): string | undefined {
  const candidates = [
    'eslint.config.ts',
    'eslint.config.mjs',
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc',
  ];

  for (const candidate of candidates) {
    try {
      deps.readFile(`${workspace}/${candidate}`);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

/** Regenerate the eslint config and open a follow-up PR. */
async function regenerateConfig(
  inputs: ActionInputs,
  context: GitHubContext,
  deps: ActionDeps,
  eslintFile: string,
): Promise<void> {
  const branch = branchNameFor(inputs.instructionFile);
  const message = commitMessageFor(inputs.instructionFile);
  const title = prTitleFor(inputs.instructionFile);

  deps.info(`Regenerating eslint config on branch ${branch}`);

  // Create or checkout the sync branch
  await deps.exec('git', ['checkout', '-b', branch]);
  await deps.exec('git', ['config', 'user.name', 'ruleprobe[bot]']);
  await deps.exec('git', ['config', 'user.email', 'ruleprobe[bot]@users.noreply.github.com']);

  // Run ruleprobe lint-config to regenerate
  const regenExitCode = await deps.runCommand('ruleprobe', [
    'lint-config',
    inputs.instructionFile,
    '--format', 'flat',
    '--output', `${context.workspace}/${eslintFile}`,
  ]);

  if (regenExitCode !== 0) {
    deps.warn('Failed to regenerate eslint config.');
    return;
  }

  // Commit and push
  await deps.exec('git', ['add', eslintFile]);
  await deps.exec('git', ['commit', '-m', message]);
  await deps.exec('git', ['push', 'origin', branch, '--force']);

  // Create PR
  await deps.exec('gh', [
    'pr', 'create',
    '--title', title,
    '--body', `${message}\n\nAuto-generated by RuleProbe drift detection.`,
    '--head', branch,
    '--base', 'main',
  ]);
}