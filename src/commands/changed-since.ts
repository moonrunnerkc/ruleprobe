/**
 * Git diff file filtering for incremental verification.
 *
 * Runs `git diff --name-only --diff-filter=ACMR <ref>...HEAD` and returns
 * the set of changed file paths as absolute, realpath-resolved strings,
 * so they compare directly against the absolute paths produced by the
 * directory walker. Uses execFile with a fixed argv array. No shell
 * expansion.
 *
 * Exit code 2 with a descriptive message when git is unavailable or the
 * ref is invalid.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Resolve the repository root for a given working directory.
 *
 * Runs `git rev-parse --show-toplevel`. This is the first git invocation
 * for the feature, so a missing-git or non-repo failure surfaces here
 * with the user-facing remediation message.
 *
 * @param cwd - Any path inside the repository (or the repo root itself)
 * @returns Absolute path to the repository root, realpath-resolved
 * @throws Error if git is unavailable or the path is not inside a repo
 */
async function resolveRepoRoot(cwd: string): Promise<string> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd }));
  } catch (err) {
    const message = (err as Error).message;
    if (/ENOENT|not found/i.test(message)) {
      throw new Error(
        `git is required for --changed-since but is not available on PATH: ${message}. Install git or remove --changed-since to verify all files.`,
      );
    }
    throw new Error(
      `Failed to locate a git repository at ${cwd}: ${message}. Ensure --changed-since is run from inside a git repository with at least one commit.`,
    );
  }
  // Realpath the toplevel so its prefix matches the realpath-resolved
  // outputDir produced by resolveSafePath. Without this the macOS
  // /var vs /private/var split breaks Set membership checks.
  return realpathSync(stdout.trim());
}

/**
 * Resolve the current HEAD commit hash.
 *
 * @param repoRoot - Absolute path to the repository root
 * @returns The full 40-character commit hash
 * @throws Error if the command fails (e.g. repo has no commits yet)
 */
async function resolveHead(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
    return stdout.trim();
  } catch (err) {
    const message = (err as Error).message;
    throw new Error(
      `Failed to resolve HEAD in repository at ${repoRoot}: ${message}. Ensure the directory contains a valid git repository with at least one commit.`,
    );
  }
}

/**
 * Get the list of files changed between a git ref and HEAD.
 *
 * Runs `git diff --name-only --diff-filter=ACMR <ref>...HEAD` where ACMR
 * means Added, Copied, Modified, Renamed. Deleted files are excluded since
 * they are no longer part of the output directory.
 *
 * Paths returned by git are relative to the repo root; this function
 * resolves them against the realpath of the repo root and returns
 * absolute path strings, so callers can compare them directly against
 * the absolute paths produced by `walkDirectorySafe`.
 *
 * @param ref - Git reference (branch name, tag, or commit hash)
 * @param cwd - Any path inside the repository
 * @returns Set of absolute, realpath-resolved file paths
 * @throws Error with exit-friendly message if git is missing or ref is invalid
 */
export async function getChangedFiles(
  ref: string,
  cwd: string,
): Promise<Set<string>> {
  const repoRoot = await resolveRepoRoot(cwd);
  const head = await resolveHead(repoRoot);
  const args = ['diff', '--name-only', '--diff-filter=ACMR', `${ref}...${head}`];

  try {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    const lines = stdout.trim().split('\n').filter((line) => line.length > 0);
    return new Set(lines.map((line) => resolve(repoRoot, line)));
  } catch (err) {
    const message = (err as Error).message;
    throw new Error(
      `Invalid git ref "${ref}": ${message}. Provide a valid branch name, tag, or commit hash.`,
    );
  }
}
