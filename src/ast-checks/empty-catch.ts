/**
 * AST check for empty catch blocks.
 *
 * Detects catch clauses with no statements in the block body.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect empty catch blocks in source code.
 *
 * Flags catch clauses where the block has zero statements. Comment-only
 * blocks are still flagged since they don't handle the error.
 */
export function checkEmptyCatch(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const catchClauses = sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause);
  for (const clause of catchClauses) {
    const block = clause.getBlock();
    if (block.getStatements().length === 0) {
      evidence.push({
        file: filePath,
        line: getLineNumber(clause),
        found: 'empty catch block',
        expected: 'catch block must handle the error',
        context: getContext(clause),
      });
    }
  }

  return evidence;
}
