/**
 * AST checks for forbidden code patterns.
 *
 * Detects usage of the "any" type and console.log calls.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence, getLineNumber, getContext } from './helpers.js';

/**
 * Detect usage of the "any" type in annotations and parameters.
 *
 * Finds AnyKeyword nodes in type annotations on variables, parameters,
 * function return types, and explicit type assertions.
 */
export function checkNoAny(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);
  for (const node of anyNodes) {
    evidence.push({
      file: filePath,
      line: getLineNumber(node),
      found: node.getParent()?.getText() ?? 'any',
      expected: 'no any type',
      context: getContext(node),
    });
  }

  return evidence;
}

/**
 * Detect console.log calls in source code.
 *
 * Matches call expressions where the expression text is "console.log".
 */
export function checkNoConsoleLog(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExpressions) {
    const expr = call.getExpression();
    const text = expr.getText();
    if (text === 'console.log') {
      evidence.push(makeEvidence(filePath, call, call.getText(), 'no console.log'));
    }
  }

  return evidence;
}
