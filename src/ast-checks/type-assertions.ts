/**
 * AST check for type assertions (as casts).
 *
 * Detects "as Type" assertions and angle-bracket assertions.
 * Many style guides prefer type guards or proper typing over assertions.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect type assertions in source code.
 *
 * Finds both "expr as Type" and "<Type>expr" syntax.
 */
export function checkNoTypeAssertions(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
  for (const node of asExpressions) {
    evidence.push({
      file: filePath,
      line: getLineNumber(node),
      found: node.getText(),
      expected: 'no type assertions (use type guards)',
      context: getContext(node),
    });
  }

  const typeAssertions = sourceFile.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression);
  for (const node of typeAssertions) {
    evidence.push({
      file: filePath,
      line: getLineNumber(node),
      found: node.getText(),
      expected: 'no type assertions (use type guards)',
      context: getContext(node),
    });
  }

  return evidence;
}
