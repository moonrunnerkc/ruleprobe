/**
 * Type-aware AST verification using a ts-morph Project loaded from a
 * tsconfig.json. Handles checks that need cross-file type info
 * (no-implicit-any, no-unused-exports, no-unresolved-imports).
 */

import { Project, type SourceFile } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  checkImplicitAny,
  checkUnusedExports,
  checkUnresolvedImports,
} from '../ast-checks/index.js';
import { SKIP_MARKER } from './ast-check-dispatch.js';

/** Pattern types that require a type-aware Project. */
export const TYPE_AWARE_PATTERNS = new Set([
  'no-implicit-any',
  'no-unused-exports',
  'no-unresolved-imports',
]);

/** Create a type-aware ts-morph Project from a tsconfig.json. */
function createTypeAwareProject(tsconfigPath: string): Project {
  return new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });
}

/**
 * Run a type-aware rule against the given files.
 *
 * Creates a Project from the tsconfig, ensures every requested file
 * is loaded into the project (some may not be referenced by the
 * tsconfig), then dispatches to the correct type-aware checker.
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to the files to check
 * @param tsconfigPath - Absolute path to the tsconfig.json
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyTypeAwareRule(
  rule: Rule,
  filePaths: string[],
  tsconfigPath: string,
): RuleResult {
  const project = createTypeAwareProject(tsconfigPath);
  const allEvidence: Evidence[] = [];

  for (const fp of filePaths) {
    try {
      if (!project.getSourceFile(fp)) {
        project.addSourceFileAtPath(fp);
      }
    } catch {
      // File could not be added to the project; the per-file loop below records this.
    }
  }

  for (const fp of filePaths) {
    try {
      const sourceFile = project.getSourceFile(fp);
      if (!sourceFile) {
        continue;
      }
      const evidence = runTypeAwareCheck(rule, fp, sourceFile, project);
      allEvidence.push(...evidence);
    } catch {
      allEvidence.push({
        file: fp,
        line: null,
        found: 'file could not be type-checked',
        expected: 'type-checkable file',
        context: '',
      });
    }
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    compliance: allEvidence.length === 0 ? 1 : 0,
    evidence: allEvidence,
  };
}

/**
 * Route a type-aware rule to its checker.
 *
 * @param rule - The rule whose pattern type selects the checker
 * @param filePath - Path to the source file
 * @param sourceFile - The ts-morph SourceFile loaded with type info
 * @param project - The type-aware Project (used by checkers needing the TypeChecker)
 * @returns Evidence array for any violations
 */
function runTypeAwareCheck(
  rule: Rule,
  filePath: string,
  sourceFile: SourceFile,
  project: Project,
): Evidence[] {
  switch (rule.pattern.type) {
    case 'no-implicit-any':
      return checkImplicitAny(sourceFile, filePath, project);
    case 'no-unused-exports':
      return checkUnusedExports(sourceFile, filePath, project);
    case 'no-unresolved-imports':
      return checkUnresolvedImports(sourceFile, filePath, project);
    default:
      return SKIP_MARKER;
  }
}
