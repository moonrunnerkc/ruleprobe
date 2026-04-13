/**
 * File walker for the semantic local extractor.
 *
 * Discovers all TypeScript and JavaScript files in a project directory,
 * respecting standard exclusion patterns (.gitignore, node_modules, etc).
 * Returns paths sorted for deterministic processing order.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Directories excluded from scanning by default. */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.git',
  '.svn',
  'coverage',
  '.turbo',
  '.cache',
  'out',
  '.output',
]);

/** File extensions included for scanning. */
const INCLUDED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Walk a project directory and collect all TS/JS source file paths.
 *
 * Skips excluded directories, hidden directories (starting with '.'),
 * and files that are not TypeScript or JavaScript. Returns sorted paths
 * for deterministic extraction hash computation.
 *
 * @param rootDir - Root directory to scan
 * @returns Sorted array of absolute file paths
 */
export function walkSourceFiles(rootDir: string): string[] {
  const files: string[] = [];
  walkRecursive(rootDir, files);
  files.sort();
  return files;
}

/**
 * Recursive directory walker.
 *
 * Uses synchronous I/O for simplicity and determinism.
 * Parse-extract-discard pattern means we do not hold large
 * data structures during the walk.
 */
function walkRecursive(dir: string, files: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) {
      continue;
    }
    if (entry.startsWith('.') && entry !== '.') {
      continue;
    }

    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      walkRecursive(fullPath, files);
    } else if (stats.isFile()) {
      const ext = getExtension(entry);
      if (ext !== null && INCLUDED_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
}

/**
 * Extract the file extension (including the dot) from a filename.
 *
 * Handles compound extensions like .d.ts and .test.ts by returning
 * only the last extension segment.
 */
function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return null;
  }
  return filename.slice(lastDot);
}

/**
 * Determine whether a file path represents test code.
 *
 * Checks directory components and filename patterns commonly used
 * for test files. Returns true for files in test directories or
 * files with test suffixes.
 *
 * @param filePath - Absolute path to the file
 * @returns True if the file is likely test code
 */
export function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const parts = lower.split('/');

  for (const part of parts) {
    if (
      part === 'test' ||
      part === 'tests' ||
      part === '__tests__' ||
      part === '__test__' ||
      part === 'spec' ||
      part === 'specs'
    ) {
      return true;
    }
  }

  const filename = parts[parts.length - 1] ?? '';
  return (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    filename.includes('_test.') ||
    filename.includes('_spec.')
  );
}
