/**
 * AST check for else blocks after return statements.
 *
 * Detects if/else patterns where the if branch contains a return
 * statement, making the else unnecessary.
 */

import { SyntaxKind, type SourceFile, type Block } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Check if a block ends with a return statement.
 */
function blockEndsWithReturn(block: Block): boolean {
  const statements = block.getStatements();
  if (statements.length === 0) {
    return false;
  }
  const last = statements[statements.length - 1]!;
  return last.getKind() === SyntaxKind.ReturnStatement;
}

/**
 * Detect else blocks that follow an if branch ending in return.
 *
 * When the if branch returns, the else is redundant and the code
 * inside it can be moved to the same level as the if.
 */
export function checkNoElseAfterReturn(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement);
  for (const ifStmt of ifStatements) {
    const thenBlock = ifStmt.getThenStatement();
    const elseBlock = ifStmt.getElseStatement();

    if (!elseBlock) {
      continue;
    }

    const thenIsBlock = thenBlock.getKind() === SyntaxKind.Block;
    if (thenIsBlock && blockEndsWithReturn(thenBlock as Block)) {
      evidence.push({
        file: filePath,
        line: getLineNumber(elseBlock),
        found: 'else after return',
        expected: 'no else after return (flatten the code)',
        context: getContext(ifStmt),
      });
    }
  }

  return evidence;
}
