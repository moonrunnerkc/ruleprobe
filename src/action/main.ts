/**
 * GitHub Action entry point.
 *
 * Reads action inputs from environment variables, constructs the
 * GitHub context, and delegates to the runner. This file is the
 * thin shell that the action.yml calls via `node dist/action/main.js`.
 */

import { runAction } from './runner.js';
import type { ActionInputs, ActionDeps, GitHubContext } from './types.js';
import { execFile } from 'node:child_process';
import { openSync, writeSync, closeSync } from 'node:fs';
import * as fs from 'node:fs/promises';

/** Parse action inputs from environment variables. */
function parseInputs(): ActionInputs {
  const mode = process.env['INPUT_MODE'] ?? 'drift';
  return {
    mode: mode === 'verify' ? 'verify' : 'drift',
    instructionFile: process.env['INPUT_INSTRUCTION_FILE'] ?? '',
    eslintFile: process.env['INPUT_ESLINT_FILE'] || undefined,
    regenerateOnDrift: process.env['INPUT_REGENERATE_ON_DRIFT'] === 'true',
    commentOnPr: process.env['INPUT_COMMENT_ON_PR'] !== 'false',
    failOnDrift: process.env['INPUT_FAIL_ON_DRIFT'] === 'true',
    outputDir: process.env['INPUT_OUTPUT_DIR'] || undefined,
    agent: process.env['INPUT_AGENT'] || undefined,
    model: process.env['INPUT_MODEL'] || undefined,
    format: process.env['INPUT_FORMAT'] || undefined,
    severity: process.env['INPUT_SEVERITY'] || undefined,
    failOnViolation: process.env['INPUT_FAIL_ON_VIOLATION'] !== 'false',
    reviewdogFormat: process.env['INPUT_REVIEWDOG_FORMAT'] === 'true',
  };
}

/** Parse GitHub context from environment variables and event payload. */
async function parseContext(): Promise<GitHubContext> {
  const eventPath = process.env['GITHUB_EVENT_PATH'] ?? '';
  let prNumber: number | undefined;

  if (eventPath) {
    try {
      const eventData = JSON.parse(await fs.readFile(eventPath, 'utf-8')) as {
        pull_request?: { number: number };
      };
      prNumber = eventData.pull_request?.number;
    } catch {
      // Not a PR event or invalid payload
    }
  }

  return {
    repository: process.env['GITHUB_REPOSITORY'] ?? '',
    apiUrl: process.env['GITHUB_API_URL'] ?? 'https://api.github.com',
    prNumber,
    token: process.env['GITHUB_TOKEN'] ?? '',
    workspace: process.env['GITHUB_WORKSPACE'] ?? process.cwd(),
    eventPath,
    eventName: process.env['GITHUB_EVENT_NAME'] ?? '',
  };
}

/** Create production deps that use real I/O. */
function createDeps(): ActionDeps {
  return {
    async runCommand(command: string, args: string[]): Promise<number> {
      return new Promise((resolve) => {
        const child = execFile(command, args);
        if (child.stdout) child.stdout.pipe(process.stdout);
        if (child.stderr) child.stderr.pipe(process.stderr);
        child.on('close', (code) => resolve(code ?? 1));
      });
    },

    async getChangedFiles(context: GitHubContext): Promise<string[]> {
      if (!context.prNumber) return [];

      const { stdout } = await execAsync('gh', [
        'pr', 'diff', String(context.prNumber),
        '--name-only',
        '--repo', context.repository,
      ]);

      return stdout.trim().split('\n').filter(Boolean);
    },

    async postComment(context: GitHubContext, prNumber: number, body: string, marker: string): Promise<void> {
      // Look for an existing comment with the marker
      const { stdout: comments } = await execAsync('gh', [
        'api',
        `repos/${context.repository}/issues/${prNumber}/comments?per_page=100`,
        '--jq', `.[] | select(.body | contains("${marker}")) | .id`,
      ]);

      const existingId = comments.trim().split('\n')[0]?.trim();

      const escapedBody = JSON.stringify(body);

      if (existingId) {
        await execAsync('gh', [
          'api', '-X', 'PATCH',
          `repos/${context.repository}/issues/comments/${existingId}`,
          '-f', `body=${escapedBody}`,
        ]);
      } else {
        await execAsync('gh', [
          'api', '-X', 'POST',
          `repos/${context.repository}/issues/${prNumber}/comments`,
          '-f', `body=${escapedBody}`,
        ]);
      }
    },

    async exec(command: string, args: string[]): Promise<{ stdout: string; exitCode: number }> {
      return execAsync(command, args);
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      await fs.writeFile(filePath, content, 'utf-8');
    },

    async readFile(filePath: string): Promise<string> {
      return fs.readFile(filePath, 'utf-8');
    },

    info(message: string): void {
      process.stdout.write(`${message}\n`);
    },

    warn(message: string): void {
      process.stderr.write(`::warning::${message}\n`);
    },

    setOutput(name: string, value: string): void {
      const outputFile = process.env['GITHUB_OUTPUT'];
      if (outputFile) {
        const fd = openSync(outputFile, 'a');
        writeSync(fd, `${name}=${value}\n`);
        closeSync(fd);
      }
    },

    setFailed(message: string): void {
      process.stderr.write(`::error::${message}\n`);
      process.exitCode = 1;
    },
  };
}

/** Promisified execFile. */
function execAsync(command: string, args: string[]): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
      resolve({ stdout: stdout ?? '', exitCode: err ? 1 : 0 });
    });
  });
}

/** Main entry point. */
async function main(): Promise<void> {
  const inputs = parseInputs();
  const context = await parseContext();
  const deps = createDeps();

  if (!inputs.instructionFile) {
    deps.setFailed('instruction-file input is required.');
    return;
  }

  await runAction(inputs, context, deps);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`::error::${message}\n`);
  process.exitCode = 2;
});