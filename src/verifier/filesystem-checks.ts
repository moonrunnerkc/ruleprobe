/**
 * File-level filesystem checks: naming conventions, test
 * co-location, file length limits, and test file naming.
 */

import { readFileSync } from 'node:fs';
import { basename, dirname, relative, extname, sep } from 'node:path';
import type { Evidence } from '../types.js';

const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Filter file paths to only TypeScript/JavaScript source files.
 *
 * Used by the AST and regex engines, both of which only understand
 * TypeScript/JavaScript syntax. Tree-sitter checks use the broader
 * filterTreeSitterFiles helper instead.
 */
export function filterSourceFiles(files: string[]): string[] {
  const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
  return files.filter((f) => {
    if (!sourceExtensions.has(extname(f))) {
      return false;
    }
    // Exclude minified files: they contain mangled identifiers that
    // produce massive false-positive counts for naming checks.
    const name = basename(f);
    if (/\.min\.[jt]sx?$/.test(name)) {
      return false;
    }
    return true;
  });
}

/**
 * Filter file paths to source files that the tree-sitter engine can
 * parse. Currently Python (.py) and Go (.go); kept separate from
 * filterSourceFiles so existing AST/regex callers do not start
 * processing non-JavaScript files implicitly.
 */
export function filterTreeSitterFiles(files: string[]): string[] {
  const tsExtensions = new Set(['.py', '.go']);
  return files.filter((f) => tsExtensions.has(extname(f)));
}

/**
 * Check that file names follow the kebab-case convention.
 *
 * Only checks TypeScript/JavaScript files. Allows dotfiles and
 * files with known special names (index, types, etc.). When changedFiles
 * is set, only checks files in the changed set.
 */
export function checkKebabCaseFileNames(
  files: string[],
  outputDir: string,
  changedFiles?: Set<string>,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  for (const filePath of sourceFiles) {
    if (changedFiles && !changedFiles.has(filePath)) {
      continue;
    }
    const name = basename(filePath);
    const nameWithoutExt = name.replace(/\.[^.]+$/, '');

    const baseName = nameWithoutExt
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '');

    if (!KEBAB_CASE_PATTERN.test(baseName)) {
      evidence.push({
        file: relative(outputDir, filePath),
        line: null,
        found: name,
        expected: 'kebab-case file name',
        context: '',
      });
    }
  }

  return evidence;
}

/**
 * Directories to skip when checking directory naming conventions.
 * Includes dotfiles, build output, and dependency directories.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', '.vscode', '.idea',
  'dist', 'build', 'coverage', '__pycache__', '.next',
  '.cache', '.turbo', '.svelte-kit',
]);

/**
 * Check that directory names follow the kebab-case convention.
 *
 * Extracts unique directory names from the file list and checks
 * each one. Skips hidden directories (starting with .) and
 * common tooling/build directories. When changedFiles is set, only
 * checks directories containing changed files.
 */
export function checkKebabCaseDirectories(
  files: string[],
  outputDir: string,
  changedFiles?: Set<string>,
): Evidence[] {
  const evidence: Evidence[] = [];
  const checked = new Set<string>();

  for (const filePath of files) {
    if (changedFiles && !changedFiles.has(filePath)) {
      continue;
    }
    const rel = relative(outputDir, filePath);
    const parts = rel.split(sep).filter(Boolean);

    // Check every directory segment except the file name itself
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      if (!dirName) continue;
      const dirPath = parts.slice(0, i + 1).join('/');

      if (checked.has(dirPath)) continue;
      checked.add(dirPath);

      // Skip hidden dirs and known exclusions
      if (dirName.startsWith('.')) continue;
      if (SKIP_DIRS.has(dirName)) continue;

      if (!KEBAB_CASE_PATTERN.test(dirName)) {
        evidence.push({
          file: dirPath,
          line: null,
          found: dirName,
          expected: 'kebab-case directory name',
          context: '',
        });
      }
    }
  }

  return evidence;
}

/**
 * Check that every source file in src/ has a corresponding test file.
 *
 * Maps src/path/to/file.ts to tests/path/to/file.test.ts.
 *
 * When changedFiles is set (incremental mode), builds the full set of
 * known test files from the complete file list, but only reports evidence
 * for source files in the changed set. This ensures the rule remains
 * checkable even when the test file itself was not modified.
 */
export function checkTestFilesExist(
  files: string[],
  outputDir: string,
  changedFiles?: Set<string>,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  const srcFiles: string[] = [];
  const testFilePaths = new Set<string>();

  // Always build the full picture: all src files and all test files
  // that exist in the output directory.
  for (const filePath of sourceFiles) {
    const rel = relative(outputDir, filePath);
    if (rel.startsWith('src/') || rel.startsWith('src\\')) {
      srcFiles.push(filePath);
    }
    if (rel.startsWith('tests/') || rel.startsWith('tests\\') ||
        rel.startsWith('test/') || rel.startsWith('test\\')) {
      testFilePaths.add(rel);
    }
  }

  // In incremental mode, only report evidence for changed source files.
  for (const srcFile of srcFiles) {
    if (changedFiles && !changedFiles.has(srcFile)) {
      continue;
    }

    const rel = relative(outputDir, srcFile);
    const srcRelative = rel.replace(/^src[/\\]/, '');
    const nameWithoutExt = srcRelative.replace(/\.[^.]+$/, '');
    const expectedTestPath = `tests/${nameWithoutExt}.test.ts`;

    if (!testFilePaths.has(expectedTestPath)) {
      evidence.push({
        file: rel,
        line: null,
        found: `no test file found`,
        expected: expectedTestPath,
        context: '',
      });
    }
  }

  return evidence;
}

/**
 * Check file length (line count) against a maximum.
 *
 * When changedFiles is set, only checks changed files.
 */
export function checkMaxFileLength(
  files: string[],
  outputDir: string,
  maxLines: number,
  changedFiles?: Set<string>,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  for (const filePath of sourceFiles) {
    if (changedFiles && !changedFiles.has(filePath)) {
      continue;
    }
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      if (lineCount > maxLines) {
        evidence.push({
          file: relative(outputDir, filePath),
          line: null,
          found: `${lineCount} lines`,
          expected: `max ${maxLines} lines`,
          context: '',
        });
      }
    } catch {
      // Skip files we can't read
    }
  }

  return evidence;
}

/**
 * Check that test files follow the *.test.ts naming pattern.
 *
 * Scans files in tests/ or test/ directories and flags any that
 * don't end with .test.ts or .spec.ts. When changedFiles is set,
 * only checks changed files.
 */
export function checkTestFileNaming(
  files: string[],
  outputDir: string,
  changedFiles?: Set<string>,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  for (const filePath of sourceFiles) {
    if (changedFiles && !changedFiles.has(filePath)) {
      continue;
    }

    const rel = relative(outputDir, filePath);
    const isTestDir = rel.startsWith('tests/') || rel.startsWith('tests\\') ||
      rel.startsWith('test/') || rel.startsWith('test\\');

    if (!isTestDir) {
      continue;
    }

    const name = basename(filePath);
    if (!name.endsWith('.test.ts') && !name.endsWith('.spec.ts') &&
        !name.endsWith('.test.js') && !name.endsWith('.spec.js')) {
      evidence.push({
        file: rel,
        line: null,
        found: name,
        expected: '*.test.ts or *.spec.ts',
        context: '',
      });
    }
  }

  return evidence;
}
