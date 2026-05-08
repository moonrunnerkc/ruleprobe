/**
 * Detect whether a PR's changed files are relevant to drift detection.
 *
 * Drift detection should run when instruction files (CLAUDE.md,
 * AGENTS.md, .cursorrules) or ESLint config files are modified.
 * If only unrelated files changed, the action skips to save time.
 */

/** File names that are instruction files. */
const INSTRUCTION_FILES = new Set([
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
]);

/** ESLint config filenames, ordered by preference (flat config first). */
const ESLINT_CONFIG_FILES = [
  'eslint.config.ts',
  'eslint.config.mjs',
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.eslintrc',
];

/** Set of all ESLint config filenames for quick lookup. */
const ESLINT_CONFIG_SET = new Set(ESLINT_CONFIG_FILES);

/**
 * Check whether any changed files are relevant to drift detection.
 *
 * Relevant files include instruction files (CLAUDE.md, AGENTS.md,
 * .cursorrules) and ESLint config files. If the user specified
 * explicit file paths, those are also considered relevant.
 *
 * @param changedFiles - List of file paths changed in the PR
 * @param opts - Optional explicit file paths to consider relevant
 * @param opts.instructionFile - Explicit instruction file path
 * @param opts.eslintFile - Explicit ESLint config file path
 * @returns true if drift detection should run
 */
export function shouldRunDrift(
  changedFiles: string[],
  opts?: { instructionFile?: string; eslintFile?: string },
): boolean {
  if (changedFiles.length === 0) return false;

  const explicitFiles = new Set<string>();
  if (opts?.instructionFile) explicitFiles.add(opts.instructionFile);
  if (opts?.eslintFile) explicitFiles.add(opts.eslintFile);

  for (const file of changedFiles) {
    const basename = file.split('/').pop() ?? file;

    if (INSTRUCTION_FILES.has(basename)) return true;
    if (ESLINT_CONFIG_SET.has(basename)) return true;
    if (explicitFiles.has(file)) return true;
  }

  return false;
}

/**
 * Auto-detect the ESLint config file from a list of repository files.
 *
 * Prefers flat config (eslint.config.*) over legacy (.eslintrc.*).
 * Only detects config files at the repository root, not in subdirectories.
 *
 * @param filesInRepo - List of file paths in the repository root
 * @returns The detected ESLint config filename, or undefined if none found
 */
export function autoDetectEslintFile(filesInRepo: string[]): string | undefined {
  const rootFiles = new Set(filesInRepo.filter((f) => !f.includes('/')));

  for (const configName of ESLINT_CONFIG_FILES) {
    if (rootFiles.has(configName)) return configName;
  }

  return undefined;
}