/**
 * Path traversal protection utilities.
 *
 * Resolves user-supplied paths, validates they stay within the
 * working directory, and provides symlink-aware directory walking.
 */

import { realpathSync, readdirSync, lstatSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

/** Options for resolveSafePath. */
export interface SafePathOptions {
  /** When true, skip the boundary check and allow paths outside cwd. */
  allowExternal?: boolean;
}

/**
 * Resolve a user-supplied path and verify it stays within the working directory.
 *
 * Resolves the path with path.resolve, then calls fs.realpathSync to follow
 * symlinks, then checks the result is a descendant of cwd. Throws if the
 * resolved path escapes cwd (unless allowExternal is set).
 *
 * @param userPath - The raw path from user input
 * @param cwd - The boundary directory (defaults to process.cwd())
 * @param options - Optional settings (e.g. allowExternal)
 * @returns The resolved, real absolute path
 * @throws Error if the resolved path is outside cwd and allowExternal is false
 */
export function resolveSafePath(
  userPath: string,
  cwd?: string,
  options?: SafePathOptions,
): string {
  const boundary = cwd ?? process.cwd();
  const resolved = resolve(boundary, userPath);

  let real: string;
  try {
    real = realpathSync(resolved);
  } catch {
    // If realpathSync fails (file doesn't exist yet), fall back to the
    // resolved path. The caller will get a "not found" error downstream.
    real = resolved;
  }

  if (!options?.allowExternal) {
    const normalizedBoundary = boundary.endsWith(sep) ? boundary : boundary + sep;

    if (real !== boundary && !real.startsWith(normalizedBoundary)) {
      throw new Error(
        `Path ${real} is outside the working directory ${boundary}. ` +
        'Use --allow-symlinks if this is intentional.',
      );
    }
  }

  return real;
}

/**
 * Walk a directory recursively, collecting file paths.
 *
 * Skips node_modules and hidden directories. When allowSymlinks is false,
 * symlinked entries are skipped with a warning to stderr.
 *
 * @param dir - Root directory to walk
 * @param allowSymlinks - Whether to follow symlinks (default: false)
 * @returns Array of absolute file paths (real files only)
 */
export function walkDirectorySafe(
  dir: string,
  allowSymlinks: boolean = false,
): string[] {
  const results: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) {
      continue;
    }

    const fullPath = join(dir, entry);

    try {
      const lstats = lstatSync(fullPath);

      if (lstats.isSymbolicLink()) {
        if (!allowSymlinks) {
          process.stderr.write(
            `Warning: skipping symlink ${fullPath}\n`,
          );
          continue;
        }
        // When allowed, fall through to check what the symlink points to
      }

      if (lstats.isDirectory()) {
        results.push(...walkDirectorySafe(fullPath, allowSymlinks));
      } else if (lstats.isSymbolicLink() && allowSymlinks) {
        const targetStat = statSync(fullPath);
        if (targetStat.isDirectory()) {
          results.push(...walkDirectorySafe(fullPath, allowSymlinks));
        } else {
          results.push(fullPath);
        }
      } else if (lstats.isFile()) {
        results.push(fullPath);
      }
    } catch {
      // Skip entries we can't stat
    }
  }

  return results;
}
