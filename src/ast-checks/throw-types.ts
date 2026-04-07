/**
 * AST check for throw statement targets.
 *
 * Ensures throw statements throw Error instances (or subclasses),
 * not raw strings, numbers, or other non-Error values.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect throw statements that throw non-Error values.
 *
 * Flags throw statements where the expression is a string literal,
 * template literal, number literal, or identifier that isn't a
 * new expression.
 */
export function checkThrowTypes(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const throwStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement);
  for (const stmt of throwStatements) {
    const expr = stmt.getExpression();
    if (!expr) {
      continue;
    }

    const kind = expr.getKind();
    const isNewExpr = kind === SyntaxKind.NewExpression;
    const isCallExpr = kind === SyntaxKind.CallExpression;

    if (!isNewExpr && !isCallExpr) {
      evidence.push({
        file: filePath,
        line: getLineNumber(stmt),
        found: expr.getText(),
        expected: 'throw new Error(...) or Error subclass',
        context: getContext(stmt),
      });
    }
  }

  return evidence;
}
