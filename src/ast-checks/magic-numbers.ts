/**
 * AST check for magic numbers.
 *
 * Detects numeric literals used directly in code outside of
 * common acceptable contexts (array indices, simple assignments
 * to named constants, etc.).
 */

import { SyntaxKind, type SourceFile, type Node } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/** Numbers that are universally acceptable as literals. */
const ALLOWED_NUMBERS = new Set([0, 1, -1, 2, 10, 100]);

/**
 * Check if a node is inside a const variable declaration.
 */
function isInConstDeclaration(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.getKind() === SyntaxKind.VariableDeclarationList) {
      const text = current.getText();
      return text.startsWith('const ');
    }
    current = current.getParent();
  }
  return false;
}

/**
 * Detect magic number usage in source code.
 *
 * Flags numeric literals that aren't in the allowed set and aren't
 * part of a named constant declaration. Skips enum members.
 */
export function checkNoMagicNumbers(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const numericLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral);
  for (const literal of numericLiterals) {
    const value = Number(literal.getText());
    if (ALLOWED_NUMBERS.has(value)) {
      continue;
    }

    if (isInConstDeclaration(literal)) {
      continue;
    }

    const parent = literal.getParent();
    if (parent && parent.getKind() === SyntaxKind.EnumMember) {
      continue;
    }

    evidence.push({
      file: filePath,
      line: getLineNumber(literal),
      found: literal.getText(),
      expected: 'extract magic numbers to named constants',
      context: getContext(literal),
    });
  }

  return evidence;
}
