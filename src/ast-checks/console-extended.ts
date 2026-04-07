/**
 * AST check for all console method calls.
 *
 * Detects console.log, console.warn, console.error, console.info,
 * console.debug, and other console methods. Broader than the
 * no-console-log check which only targets console.log.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence } from './helpers.js';

/**
 * Detect any console.* calls in source code.
 *
 * Matches call expressions where the expression starts with "console.".
 */
export function checkNoConsoleExtended(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExpressions) {
    const expr = call.getExpression();
    const text = expr.getText();
    if (text.startsWith('console.')) {
      evidence.push(makeEvidence(filePath, call, call.getText(), 'no console statements'));
    }
  }

  return evidence;
}
