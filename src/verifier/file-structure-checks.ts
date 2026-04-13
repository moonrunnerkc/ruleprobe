/**
 * File structure verification checks.
 *
 * Implements checks for directory existence, file pattern existence,
 * module index requirements, and test colocation analysis.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import type { Evidence } from '../types.js';

/**
 * Check that a directory exists and contains files.
 *
 * @param files - All files in the project
 * @param outputDir - Project root directory
 * @param targetDir - Directory path to check (relative to outputDir)
 * @returns Evidence array (empty if directory exists with files)
 */
export function checkDirectoryExistsWithFiles(
  files: string[],
  outputDir: string,
  targetDir: string,
): Evidence[] {
  const normalizedTarget = targetDir.replace(/^\//, '').replace(/\/$/, '');
  const dirPath = join(outputDir, normalizedTarget);

  if (!existsSync(dirPath)) {
    return [{
      file: dirPath,
      line: null,
      found: 'directory does not exist',
      expected: `${normalizedTarget}/ directory`,
      context: `Instruction requires ${normalizedTarget}/ directory`,
    }];
  }

  // Check if directory has any files
  const filesInDir = files.filter((f) => {
    const rel = relative(outputDir, f);
    return rel.startsWith(normalizedTarget + '/') || rel.startsWith(normalizedTarget + '\\');
  });

  if (filesInDir.length === 0) {
    return [{
      file: dirPath,
      line: null,
      found: 'directory exists but is empty',
      expected: `${normalizedTarget}/ with files`,
      context: `Directory ${normalizedTarget}/ exists but contains no files`,
    }];
  }

  return [];
}

/**
 * Check that a file matching a pattern exists.
 *
 * @param files - All files in the project
 * @param outputDir - Project root directory
 * @param filePattern - File name or glob pattern to find
 * @returns Evidence array (empty if file exists)
 */
export function checkFilePatternExists(
  files: string[],
  outputDir: string,
  filePattern: string,
): Evidence[] {
  const found = files.some((f) => {
    const rel = relative(outputDir, f);
    return rel === filePattern || basename(f) === filePattern;
  });

  if (!found) {
    return [{
      file: outputDir,
      line: null,
      found: `${filePattern} not found`,
      expected: filePattern,
      context: `Instruction requires ${filePattern}`,
    }];
  }

  return [];
}

/**
 * Check that every module directory has an index file.
 *
 * A "module directory" is defined as a directory containing at least
 * one source file (.ts, .tsx, .js, .jsx). Returns a compliance ratio.
 *
 * @param files - All files in the project
 * @param outputDir - Project root directory
 * @param indexFileName - e.g. "index.ts"
 * @returns Object with evidence and compliance ratio
 */
export function checkModuleIndexRequired(
  files: string[],
  outputDir: string,
  indexFileName: string,
): { evidence: Evidence[]; compliance: number } {
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const sourceFiles = files.filter((f) => {
    const ext = f.slice(f.lastIndexOf('.'));
    return sourceExts.has(ext);
  });

  // Find all directories containing source files
  const moduleDirs = new Set<string>();
  for (const f of sourceFiles) {
    const dir = dirname(f);
    if (dir !== outputDir) {
      moduleDirs.add(dir);
    }
  }

  if (moduleDirs.size === 0) {
    return { evidence: [], compliance: 1 };
  }

  const evidence: Evidence[] = [];
  let withIndex = 0;

  for (const dir of moduleDirs) {
    const indexPath = join(dir, indexFileName);
    if (existsSync(indexPath)) {
      withIndex++;
    } else {
      evidence.push({
        file: dir,
        line: null,
        found: `no ${indexFileName} in ${relative(outputDir, dir)}/`,
        expected: indexFileName,
        context: `Module directory ${relative(outputDir, dir)}/ missing ${indexFileName}`,
      });
    }
  }

  const compliance = moduleDirs.size > 0
    ? withIndex / moduleDirs.size
    : 1;

  return { evidence, compliance };
}

/**
 * Calculate test colocation ratio.
 *
 * Checks how many source files have a corresponding test file
 * in the same directory or a sibling __tests__ directory.
 *
 * @param files - All files in the project
 * @param outputDir - Project root
 * @returns Object with evidence and compliance ratio
 */
export function checkTestColocation(
  files: string[],
  outputDir: string,
): { evidence: Evidence[]; compliance: number } {
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const testPattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

  const sourceFiles = files.filter((f) => {
    return sourceExts.has(f.slice(f.lastIndexOf('.'))) && !testPattern.test(f);
  });

  const testFiles = new Set(files.filter((f) => testPattern.test(f)));

  if (sourceFiles.length === 0) {
    return { evidence: [], compliance: 1 };
  }

  const evidence: Evidence[] = [];
  let withTest = 0;

  for (const src of sourceFiles) {
    const dir = dirname(src);
    const base = basename(src).replace(/\.(ts|tsx|js|jsx)$/, '');

    // Check for test file in same directory
    const colocatedPatterns = [
      join(dir, `${base}.test.ts`),
      join(dir, `${base}.spec.ts`),
      join(dir, `${base}.test.tsx`),
      join(dir, `${base}.test.js`),
    ];

    // Check for test file in __tests__ subdirectory
    const testDirPatterns = [
      join(dir, '__tests__', `${base}.test.ts`),
      join(dir, '__tests__', `${base}.spec.ts`),
      join(dir, '__tests__', `${base}.test.tsx`),
      join(dir, '__tests__', `${base}.test.js`),
    ];

    const allPatterns = [...colocatedPatterns, ...testDirPatterns];
    const hasTest = allPatterns.some((p) => testFiles.has(p));

    if (hasTest) {
      withTest++;
    } else {
      evidence.push({
        file: src,
        line: null,
        found: `no colocated test for ${relative(outputDir, src)}`,
        expected: 'colocated test file',
        context: `Source file ${relative(outputDir, src)} has no adjacent test`,
      });
    }
  }

  const compliance = sourceFiles.length > 0
    ? withTest / sourceFiles.length
    : 1;

  return { evidence, compliance };
}
