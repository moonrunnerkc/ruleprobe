/**
 * Agent run metadata capture and validation.
 *
 * In v0.1.0 this is manual: the user passes --agent and --model flags,
 * and this module records them alongside a timestamp. Validates that the
 * output directory exists and contains at least one code file.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/** File extensions recognized as code output. */
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/**
 * Validate that an output directory exists and contains code files.
 *
 * Recursively checks for .ts, .tsx, .js, or .jsx files. Throws
 * with actionable error messages if validation fails.
 *
 * @param outputDir - Path to the agent's output directory
 * @throws Error if directory is missing or contains no code files
 */
export function validateOutputDir(outputDir: string): void {
  if (!existsSync(outputDir)) {
    throw new Error(
      `Output directory does not exist: ${outputDir}\n` +
      'Point to the directory containing the agent\'s generated files.',
    );
  }

  const stat = statSync(outputDir);
  if (!stat.isDirectory()) {
    throw new Error(
      `Not a directory: ${outputDir}\n` +
      'The output path must be a directory, not a file.',
    );
  }

  const codeFiles = findCodeFiles(outputDir);
  if (codeFiles.length === 0) {
    throw new Error(
      `No code files found in: ${outputDir}\n` +
      'Expected at least one .ts, .tsx, .js, or .jsx file.',
    );
  }
}

/**
 * Recursively find code files in a directory.
 *
 * Skips node_modules and hidden directories.
 *
 * @param dir - Directory to search
 * @returns Array of absolute file paths
 */
function findCodeFiles(dir: string): string[] {
  const results: string[] = [];

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findCodeFiles(fullPath));
    } else if (CODE_EXTENSIONS.has(extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Create an ISO 8601 timestamp for the current moment.
 *
 * @returns ISO 8601 timestamp string
 */
export function currentTimestamp(): string {
  return new Date().toISOString();
}
