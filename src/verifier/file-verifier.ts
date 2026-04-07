/**
 * File system verifier.
 *
 * Checks file-level and project-level structural rules: file naming
 * conventions, test file co-location, directory structure, and
 * file length limits.
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, relative, extname, resolve, dirname, join } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import { walkDirectorySafe } from '../utils/safe-path.js';

const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Collect all file paths under a directory with symlink awareness.
 *
 * Delegates to walkDirectorySafe, which uses lstatSync to detect
 * symlinks and skips them when allowSymlinks is false.
 *
 * @param dir - Root directory to scan
 * @param allowSymlinks - Whether to follow symlinks (default: false)
 * @returns Array of absolute file paths
 */
function collectFiles(dir: string, allowSymlinks: boolean = false): string[] {
  return walkDirectorySafe(dir, allowSymlinks);
}

/**
 * Filter file paths to only TypeScript/JavaScript source files.
 */
function filterSourceFiles(files: string[]): string[] {
  const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
  return files.filter((f) => sourceExtensions.has(extname(f)));
}

/**
 * Check that file names follow the kebab-case convention.
 *
 * Only checks TypeScript/JavaScript files. Allows dotfiles and
 * files with known special names (index, types, etc.).
 */
function checkKebabCaseFileNames(
  files: string[],
  outputDir: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  for (const filePath of sourceFiles) {
    const name = basename(filePath);
    const nameWithoutExt = name.replace(/\.[^.]+$/, '');

    // Skip test file suffixes (file.test.ts, file.spec.ts)
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
 * Check that every source file in src/ has a corresponding test file.
 *
 * Maps src/path/to/file.ts to tests/path/to/file.test.ts.
 */
function checkTestFilesExist(
  files: string[],
  outputDir: string,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  // Find src files and tests files
  const srcFiles: string[] = [];
  const testFilePaths = new Set<string>();

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

  for (const srcFile of srcFiles) {
    const rel = relative(outputDir, srcFile);
    // src/path/to/file.ts => tests/path/to/file.test.ts
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
 */
function checkMaxFileLength(
  files: string[],
  outputDir: string,
  maxLines: number,
): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFiles = filterSourceFiles(files);

  for (const filePath of sourceFiles) {
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
 * Find tsconfig.json by walking up from outputDir through ancestor
 * directories (up to 5 levels or filesystem root).
 */
function findTsconfig(outputDir: string): { path: string; searched: string[] } | { path: null; searched: string[] } {
  const searched: string[] = [];
  let current = resolve(outputDir);
  const maxLevels = 5;

  for (let i = 0; i <= maxLevels; i++) {
    const candidate = join(current, 'tsconfig.json');
    searched.push(current);
    if (existsSync(candidate)) {
      return { path: candidate, searched };
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return { path: null, searched };
}

/**
 * Check for the existence of a tsconfig.json with strict mode enabled.
 *
 * Walks up from outputDir to find tsconfig.json in ancestor directories.
 */
function checkStrictMode(outputDir: string): Evidence[] {
  const result = findTsconfig(outputDir);

  if (result.path === null) {
    return [{
      file: 'tsconfig.json',
      line: null,
      found: `tsconfig.json not found (searched: ${result.searched.join(', ')})`,
      expected: 'tsconfig.json with strict: true',
      context: '',
    }];
  }

  try {
    const content = readFileSync(result.path, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'compilerOptions' in parsed
    ) {
      const opts = (parsed as Record<string, unknown>)['compilerOptions'];
      if (typeof opts === 'object' && opts !== null && 'strict' in opts) {
        const strict = (opts as Record<string, unknown>)['strict'];
        if (strict === true) {
          return [];
        }
      }
    }
  } catch {
    // JSON parse failed
  }

  return [{
    file: 'tsconfig.json',
    line: null,
    found: 'strict mode not enabled',
    expected: 'compilerOptions.strict: true',
    context: '',
  }];
}

/**
 * Verify a filesystem rule against an output directory.
 *
 * Routes to the appropriate check function based on the rule's
 * verification pattern type.
 *
 * @param rule - The rule to verify
 * @param outputDir - Root directory of agent output
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyFileSystemRule(
  rule: Rule,
  outputDir: string,
  allowSymlinks: boolean = false,
): RuleResult {
  const allFiles = collectFiles(outputDir, allowSymlinks);
  const patternType = rule.pattern.type;
  let evidence: Evidence[];

  switch (patternType) {
    case 'kebab-case':
      evidence = checkKebabCaseFileNames(allFiles, outputDir);
      break;
    case 'test-files-exist':
      evidence = checkTestFilesExist(allFiles, outputDir);
      break;
    case 'test-file-naming':
      // This check is handled by kebab-case (test files also must be kebab-case)
      // and test-files-exist (verifies the pattern). No separate action needed.
      evidence = [];
      break;
    case 'max-file-length': {
      const maxLines = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 300;
      evidence = checkMaxFileLength(allFiles, outputDir, maxLines);
      break;
    }
    case 'strict-mode':
      evidence = checkStrictMode(outputDir);
      break;
    default:
      evidence = [];
  }

  return {
    rule,
    passed: evidence.length === 0,
    evidence,
  };
}

export { collectFiles, filterSourceFiles };
export type { Evidence };
