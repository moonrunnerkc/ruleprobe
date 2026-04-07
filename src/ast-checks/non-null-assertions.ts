/**
 * AST check for non-null assertion operator (!).
 *
 * Detects usage of the non-null assertion postfix operator,
 * which bypasses TypeScript's strict null checks.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect non-null assertion operator usage.
 *
 * Flags any use of the "!" postfix operator on expressions.
 */
export function checkNoNonNullAssertions(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const nodes = sourceFile.getDescendantsOfKind(SyntaxKind.NonNullExpression);
  for (const node of nodes) {
    evidence.push({
      file: filePath,
      line: getLineNumber(node),
      found: node.getText(),
      expected: 'no non-null assertions (use proper null checks)',
      context: getContext(node),
    });
  }

  return evidence;
}
