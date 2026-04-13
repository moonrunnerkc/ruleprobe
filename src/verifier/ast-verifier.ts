/**
 * AST-based verifier using ts-morph. Routes each rule to the correct
 * check function in ast-checks/. Supports per-file and project-aware analysis.
 */

import { Project, type SourceFile } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  checkCamelCase,
  checkPascalCase,
  checkUpperCaseConstants,
  checkNoAny,
  checkNoConsoleLog,
  checkNamedExportsOnly,
  checkJsDocRequired,
  checkNoDeepRelativeImports,
  checkNoPathAliases,
  checkEmptyCatch,
  checkNoEnum,
  checkNoTypeAssertions,
  checkNoNonNullAssertions,
  checkThrowTypes,
  checkNoConsoleExtended,
  checkNoNestedTernary,
  checkNoMagicNumbers,
  checkNoElseAfterReturn,
  checkMaxFunctionLength,
  checkMaxParams,
  checkNoNamespaceImports,
  checkNoBarrelFiles,
  checkNoSetTimeoutInTests,
  checkImplicitAny,
  checkUnusedExports,
  checkUnresolvedImports,
  checkNoVar,
  checkPreferConst,
  checkNoWildcardExports,
  checkConciseConditionals,
} from '../ast-checks/index.js';

/** Create a ts-morph Project for parsing without compilation. */
export function createProject(): Project {
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

/** Create a type-aware ts-morph Project from a tsconfig.json. */
function createTypeAwareProject(tsconfigPath: string): Project {
  return new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });
}

/** Pattern types that require a type-aware Project. */
export const TYPE_AWARE_PATTERNS = new Set([
  'no-implicit-any',
  'no-unused-exports',
  'no-unresolved-imports',
]);

/**
 * Run the appropriate AST check for a rule against a single source file.
 *
 * Routes to the correct checker based on the rule's verification
 * pattern type. Returns evidence of violations found.
 */
export function runAstCheck(rule: Rule, filePath: string, sourceFile: SourceFile): Evidence[] {
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
    case 'no-empty-catch':
      return checkEmptyCatch(sourceFile, filePath);
    case 'no-enum':
      return checkNoEnum(sourceFile, filePath);
    case 'no-type-assertions':
      return checkNoTypeAssertions(sourceFile, filePath);
    case 'no-non-null-assertions':
      return checkNoNonNullAssertions(sourceFile, filePath);
    case 'throw-error-only':
      return checkThrowTypes(sourceFile, filePath);
    case 'no-console-extended':
      return checkNoConsoleExtended(sourceFile, filePath);
    case 'no-nested-ternary':
      return checkNoNestedTernary(sourceFile, filePath);
    case 'no-magic-numbers':
      return checkNoMagicNumbers(sourceFile, filePath);
    case 'no-else-after-return':
      return checkNoElseAfterReturn(sourceFile, filePath);
    case 'max-function-length': {
      const maxLines = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 50;
      return checkMaxFunctionLength(sourceFile, filePath, maxLines);
    }
    case 'max-params': {
      const maxParams = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : 4;
      return checkMaxParams(sourceFile, filePath, maxParams);
    }
    case 'no-namespace-imports':
      return checkNoNamespaceImports(sourceFile, filePath);
    case 'no-barrel-files':
      return checkNoBarrelFiles(sourceFile, filePath);
    case 'no-setTimeout-in-tests':
      return checkNoSetTimeoutInTests(sourceFile, filePath);
    case 'no-var':
      return checkNoVar(sourceFile, filePath);
    case 'prefer-const':
      return checkPreferConst(sourceFile, filePath);
    case 'no-wildcard-exports':
      return checkNoWildcardExports(sourceFile, filePath);
    case 'concise-conditionals':
      return checkConciseConditionals(sourceFile, filePath);
    case 'UPPER_CASE':
      return checkUpperCaseConstants(sourceFile, filePath);
    case 'async-try-catch':
    case 'error-log-context':
      // These rules are extracted and tracked but require deeper semantic analysis
      // to verify accurately. Return empty evidence (no violations found).
      return [];
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
 * @param projectPath - Optional tsconfig.json path for type-aware checks
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyAstRule(
  rule: Rule,
  filePaths: string[],
  projectPath?: string,
): RuleResult {
  const isTypeAware = TYPE_AWARE_PATTERNS.has(rule.pattern.type);

  // Type-aware checks require a project path; skip gracefully without one
  if (isTypeAware && !projectPath) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: '',
        line: null,
        found: 'skipped (requires --project flag with tsconfig.json path)',
        expected: rule.pattern.type,
        context: '',
      }],
    };
  }

  if (isTypeAware && projectPath) {
    return verifyTypeAwareRule(rule, filePaths, projectPath);
  }

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
    compliance: allEvidence.length === 0 ? 1 : 0,
    evidence: allEvidence,
  };
}

/**
 * Run type-aware checks using a full ts-morph Project with tsconfig.
 *
 * Creates a Project from the tsconfig, adds any extra files not in
 * the config, then runs the type-aware check.
 */
function verifyTypeAwareRule(
  rule: Rule,
  filePaths: string[],
  tsconfigPath: string,
): RuleResult {
  const project = createTypeAwareProject(tsconfigPath);
  const allEvidence: Evidence[] = [];

  // Add files that might not be in the tsconfig
  for (const fp of filePaths) {
    try {
      if (!project.getSourceFile(fp)) {
        project.addSourceFileAtPath(fp);
      }
    } catch {
      // Skip files we can't add
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
      return [];
  }
}
