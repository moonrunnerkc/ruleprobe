/**
 * AST naming convention checks.
 *
 * Verifies camelCase for variables/functions and PascalCase for
 * types, interfaces, classes, and enums.
 */

import { SyntaxKind, VariableDeclarationKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence } from './helpers.js';

const CAMEL_CASE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Check whether an identifier is camelCase.
 * Allows single-letter identifiers and underscore-prefixed names.
 */
function isCamelCase(name: string): boolean {
  if (name.startsWith('_')) {
    return isCamelCase(name.slice(1));
  }
  return CAMEL_CASE_PATTERN.test(name);
}

/**
 * Check whether an identifier is PascalCase.
 */
function isPascalCase(name: string): boolean {
  return PASCAL_CASE_PATTERN.test(name);
}

/**
 * Verify camelCase naming for variables and functions.
 *
 * Checks variable declarations and function declarations. Skips
 * destructured bindings and UPPER_SNAKE_CASE constants.
 */
export function checkCamelCase(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const allVarDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of allVarDecls) {
    const name = decl.getName();
    if (name.includes('{') || name.includes('[')) {
      continue;
    }
    // Skip UPPER_SNAKE_CASE constants (e.g. MAX_RETRIES)
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
      continue;
    }
    // Skip PascalCase names: these are typically React components,
    // classes, or type-like constructs that follow PascalCase convention
    if (isPascalCase(name)) {
      continue;
    }
    if (!isCamelCase(name)) {
      evidence.push(makeEvidence(filePath, decl, name, 'camelCase'));
    }
  }

  const allFuncDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of allFuncDecls) {
    const name = func.getName();
    // Skip PascalCase function names (React components declared as functions)
    if (name && isPascalCase(name)) {
      continue;
    }
    if (name && !isCamelCase(name)) {
      evidence.push(makeEvidence(filePath, func, name, 'camelCase'));
    }
  }

  return evidence;
}

/**
 * Verify PascalCase naming for types, interfaces, classes, and enums.
 */
export function checkPascalCase(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    if (!isPascalCase(name)) {
      evidence.push(makeEvidence(filePath, iface, name, 'PascalCase'));
    }
  }

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    if (!isPascalCase(name)) {
      evidence.push(makeEvidence(filePath, typeAlias, name, 'PascalCase'));
    }
  }

  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (name && !isPascalCase(name)) {
      evidence.push(makeEvidence(filePath, cls, name, 'PascalCase'));
    }
  }

  for (const enumDecl of sourceFile.getEnums()) {
    const name = enumDecl.getName();
    if (!isPascalCase(name)) {
      evidence.push(makeEvidence(filePath, enumDecl, name, 'PascalCase'));
    }
  }

  return evidence;
}

const UPPER_CASE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Verify UPPER_CASE naming for constants (const at module scope).
 *
 * Only checks top-level const declarations that are primitive values
 * (string, number, boolean literals). Skips function expressions,
 * arrow functions, objects, and arrays since UPPER_CASE is typically
 * only expected for primitive constant values.
 */
export function checkUpperCaseConstants(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const statements = sourceFile.getStatements();
  for (const stmt of statements) {
    if (stmt.getKind() !== SyntaxKind.VariableStatement) {
      continue;
    }
    const varStmt = stmt.asKindOrThrow(SyntaxKind.VariableStatement);
    const declList = varStmt.getDeclarationList();

    if (declList.getDeclarationKind() !== VariableDeclarationKind.Const) {
      // Only check const declarations
      continue;
    }

    for (const decl of declList.getDeclarations()) {
      const name = decl.getName();
      // Skip destructured bindings
      if (name.includes('{') || name.includes('[')) {
        continue;
      }
      const init = decl.getInitializer();
      if (!init) continue;

      const kind = init.getKind();
      const isPrimitive = kind === SyntaxKind.StringLiteral
        || kind === SyntaxKind.NumericLiteral
        || kind === SyntaxKind.TrueKeyword
        || kind === SyntaxKind.FalseKeyword
        || kind === SyntaxKind.PrefixUnaryExpression;

      if (!isPrimitive) continue;

      // Already UPPER_CASE: fine. camelCase or PascalCase for a primitive const: flag.
      if (!UPPER_CASE_PATTERN.test(name) && !name.startsWith('_')) {
        evidence.push(makeEvidence(filePath, decl, name, 'UPPER_CASE'));
      }
    }
  }

  return evidence;
}
