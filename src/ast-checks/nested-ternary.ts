/**
 * AST check for nested ternary expressions.
 *
 * Detects ternary operators nested inside other ternary operators,
 * which reduce code readability.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect nested ternary expressions.
 *
 * Finds ConditionalExpression nodes whose parent is also a
 * ConditionalExpression, indicating nesting.
 */
export function checkNoNestedTernary(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];
  const reported = new Set<number>();

  const ternaries = sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
  for (const ternary of ternaries) {
    const nested = ternary.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
    for (const inner of nested) {
      const line = getLineNumber(inner);
      if (!reported.has(line)) {
        reported.add(line);
        evidence.push({
          file: filePath,
          line,
          found: inner.getText().slice(0, 80),
          expected: 'no nested ternary expressions',
          context: getContext(inner),
        });
      }
    }
  }

  return evidence;
}
