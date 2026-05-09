/**
 * Dispatch table for AST checks. Routes each rule's pattern type to
 * the corresponding ts-morph based checker function.
 */

import type { SourceFile } from 'ts-morph';
import type { Rule, Evidence } from '../types.js';
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
  checkNoVar,
  checkPreferConst,
  checkNoWildcardExports,
  checkConciseConditionals,
} from '../ast-checks/index.js';

/** Sentinel value returned by runAstCheck when a pattern type has no implementation. */
export const SKIP_MARKER: Evidence[] = [];

/** Check whether evidence array is the skip marker. */
export function isSkipMarker(evidence: Evidence[]): boolean {
  return evidence === SKIP_MARKER;
}

/** Default maxDepth for no-deep-relative-imports when none is specified on the rule. */
const DEFAULT_MAX_RELATIVE_DEPTH = 2;
/** Default max function length when none is specified on the rule. */
const DEFAULT_MAX_FUNCTION_LENGTH = 50;
/** Default max params per function when none is specified on the rule. */
const DEFAULT_MAX_PARAMS = 4;

/**
 * Run the appropriate AST check for a rule against a single source file.
 *
 * Routes to the correct checker based on the rule's verification
 * pattern type. Returns evidence of violations found, or SKIP_MARKER
 * when the pattern has no AST implementation.
 *
 * @param rule - The rule to verify
 * @param filePath - Path to the source file being checked
 * @param sourceFile - ts-morph SourceFile already loaded into a Project
 * @returns Evidence array, or SKIP_MARKER when the check is unsupported
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
        : DEFAULT_MAX_RELATIVE_DEPTH;
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
        : DEFAULT_MAX_FUNCTION_LENGTH;
      return checkMaxFunctionLength(sourceFile, filePath, maxLines);
    }
    case 'max-params': {
      const maxParams = typeof rule.pattern.expected === 'string'
        ? parseInt(rule.pattern.expected, 10)
        : DEFAULT_MAX_PARAMS;
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
      return SKIP_MARKER;
    default:
      return SKIP_MARKER;
  }
}
