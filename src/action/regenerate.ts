/**
 * Regenerate an ESLint config from an instruction file and open
 * a follow-up PR on a deterministic branch.
 *
 * The branch name is derived from the instruction file path so
 * repeated runs against the same file always target the same branch.
 */

import { createHash } from 'node:crypto';

/** Prefix for regeneration branches. */
const BRANCH_PREFIX = 'ruleprobe/sync-';

/**
 * Generate a deterministic branch name from the instruction file path.
 *
 * @param instructionFile - Path to the instruction file
 * @returns A branch name like "ruleprobe/sync-abc1234"
 */
export function branchNameFor(instructionFile: string): string {
  const hash = createHash('sha256').update(instructionFile).digest('hex').slice(0, 8);
  return `${BRANCH_PREFIX}${hash}`;
}

/**
 * Generate a commit message for the regenerated config.
 *
 * @param instructionFile - Path to the instruction file
 * @returns A conventional-commit message
 */
export function commitMessageFor(instructionFile: string): string {
  return `chore: sync eslint config with ${instructionFile}`;
}

/**
 * Generate a PR title for the regeneration PR.
 *
 * @param instructionFile - Path to the instruction file
 * @returns A descriptive PR title
 */
export function prTitleFor(instructionFile: string): string {
  return `Sync ESLint config with ${instructionFile} (drift detected)`;
}