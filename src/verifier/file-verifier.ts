/**
 * File system verifier.
 *
 * Routes filesystem rules to the appropriate check function
 * and manages directory walking with symlink awareness.
 * Unknown pattern types are skipped rather than false-passed.
 */

import type { Rule, RuleResult, Evidence } from '../types.js';
import { walkDirectorySafe } from '../utils/safe-path.js';
import {
  filterSourceFiles,
  checkKebabCaseFileNames,
  checkKebabCaseDirectories,
  checkTestFilesExist,
  checkMaxFileLength,
  checkTestFileNaming,
} from './filesystem-checks.js';
import {
  checkStrictMode,
  checkFileExists,
  checkFormatterConfigExists,
  checkPinnedDependencies,
} from './project-checks.js';
import {
  checkDirectoryExistsWithFiles,
  checkFilePatternExists,
  checkModuleIndexRequired,
  checkTestColocation,
} from './file-structure-checks.js';

/** Pattern types handled by the filesystem verifier. */
const SUPPORTED_FILE_PATTERNS = new Set([
  'kebab-case',
  'kebab-case-directories',
  'test-files-exist',
  'test-file-naming',
  'max-file-length',
  'strict-mode',
  'readme-exists',
  'changelog-exists',
  'formatter-config-exists',
  'pinned-dependencies',
  'directory-exists-with-files',
  'file-pattern-exists',
  'module-index-required',
  'test-colocation',
]);

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
 * Verify a filesystem rule against pre-collected files.
 *
 * Routes to the appropriate check function based on the rule's
 * verification pattern type. Accepts a pre-collected file list
 * to avoid redundant directory walks.
 *
 * @param rule - The rule to verify
 * @param outputDir - Root directory of agent output
 * @param files - Pre-collected file paths from the directory walk
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyFileSystemRule(
  rule: Rule,
  outputDir: string,
  files: string[],
): RuleResult {
  const patternType = rule.pattern.type;

  // Skip unknown pattern types instead of false-passing
  if (!SUPPORTED_FILE_PATTERNS.has(patternType)) {
    return {
      rule,
      passed: false,
      compliance: 0,
      evidence: [],
      skipped: true,
    };
  }
  let evidence: Evidence[] = [];

  switch (patternType) {
    case 'kebab-case':
      evidence = checkKebabCaseFileNames(files, outputDir);
      break;
    case 'kebab-case-directories':
      evidence = checkKebabCaseDirectories(files, outputDir);
      break;
    case 'test-files-exist':
      evidence = checkTestFilesExist(files, outputDir);
      break;
    case 'test-file-naming':
      evidence = checkTestFileNaming(files, outputDir);
      break;
    case 'max-file-length': {
      const maxLines = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 300;
      evidence = checkMaxFileLength(files, outputDir, maxLines);
      break;
    }
    case 'strict-mode':
      evidence = checkStrictMode(outputDir);
      break;
    case 'readme-exists':
      evidence = checkFileExists(files, outputDir, 'README.md');
      break;
    case 'changelog-exists':
      evidence = checkFileExists(files, outputDir, 'CHANGELOG.md');
      break;
    case 'formatter-config-exists':
      evidence = checkFormatterConfigExists(files, outputDir);
      break;
    case 'pinned-dependencies':
      evidence = checkPinnedDependencies(outputDir);
      break;
    case 'directory-exists-with-files': {
      const targetDir = typeof rule.pattern.target === 'string'
        ? rule.pattern.target
        : '';
      evidence = checkDirectoryExistsWithFiles(files, outputDir, targetDir);
      break;
    }
    case 'file-pattern-exists': {
      const filePattern = typeof rule.pattern.target === 'string'
        ? rule.pattern.target
        : '';
      evidence = checkFilePatternExists(files, outputDir, filePattern);
      break;
    }
    case 'module-index-required': {
      const indexFile = typeof rule.pattern.target === 'string'
        ? rule.pattern.target
        : 'index.ts';
      const result = checkModuleIndexRequired(files, outputDir, indexFile);
      evidence = result.evidence;
      return {
        rule,
        passed: result.compliance >= 0.8,
        compliance: result.compliance,
        evidence: result.evidence,
      };
    }
    case 'test-colocation': {
      const colocationResult = checkTestColocation(files, outputDir);
      return {
        rule,
        passed: colocationResult.compliance >= 0.8,
        compliance: colocationResult.compliance,
        evidence: colocationResult.evidence,
      };
    }
  }

  // All supported patterns are handled above; the earlier guard
  // ensures we never reach this point with an unsupported pattern.
  return {
    rule,
    passed: evidence.length === 0,
    compliance: evidence.length === 0 ? 1 : 0,
    evidence,
  };

  return {
    rule,
    passed: evidence.length === 0,
    compliance: evidence.length === 0 ? 1 : 0,
    evidence,
  };
}

export { collectFiles, filterSourceFiles };
export type { Evidence };
