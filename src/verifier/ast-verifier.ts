/**
 * AST-based verifier using ts-morph.
 *
 * Loads TypeScript/JavaScript files into a ts-morph Project and
 * routes each rule to the correct check function in ast-checks/.
 */

import { Project, type SourceFile } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  checkCamelCase,
  checkPascalCase,
  checkNoAny,
  checkNoConsoleLog,
  checkNamedExportsOnly,
  checkJsDocRequired,
  checkNoDeepRelativeImports,
  checkNoPathAliases,
} from '../ast-checks/index.js';

/**
 * Create a ts-morph Project configured for parsing without compilation.
 *
 * Uses liberal compiler options so that agent output files can be
 * parsed even if they have type errors.
 */
function createProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
}

/**
 * Run the appropriate AST check for a rule against a single source file.
 *
 * Routes to the correct checker based on the rule's verification
 * pattern type. Returns evidence of violations found.
 */
function runAstCheck(rule: Rule, filePath: string, sourceFile: SourceFile): Evidence[] {
  const patternType = rule.pattern.type;

  switch (patternType) {
    case 'camelCase':
      return checkCamelCase(sourceFile, filePath);
    case 'PascalCase':
      return checkPascalCase(sourceFile, filePath);
    case 'no-any':
      return checkNoAny(sourceFile, filePath);
    case 'no-console-log':
      return checkNoConsoleLog(sourceFile, filePath);
    case 'named-exports-only':
      return checkNamedExportsOnly(sourceFile, filePath);
    case 'jsdoc-required':
      return checkJsDocRequired(sourceFile, filePath);
    case 'no-deep-relative-imports': {
      const maxDepth = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 2;
      return checkNoDeepRelativeImports(sourceFile, filePath, maxDepth);
    }
    case 'no-path-aliases':
      return checkNoPathAliases(sourceFile, filePath);
    default:
      return [];
  }
}

/**
 * Verify a rule against all TypeScript/JavaScript files.
 *
 * Loads all matching files into a ts-morph Project and runs the
 * appropriate AST check. Files that fail to parse are skipped with
 * a warning in evidence.
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to the files to check
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyAstRule(rule: Rule, filePaths: string[]): RuleResult {
  const project = createProject();
  const allEvidence: Evidence[] = [];

  for (const fp of filePaths) {
    try {
      const sourceFile = project.addSourceFileAtPath(fp);
      const evidence = runAstCheck(rule, fp, sourceFile);
      allEvidence.push(...evidence);
    } catch {
      allEvidence.push({
        file: fp,
        line: null,
        found: 'file could not be parsed by ts-morph',
        expected: 'parseable TypeScript/JavaScript file',
        context: '',
      });
    }
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    evidence: allEvidence,
  };
}
