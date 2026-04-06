/**
 * Shared helpers for AST check modules.
 *
 * Provides utility functions that all check modules need:
 * line number extraction and code context snippets.
 */

import type { Node } from 'ts-morph';
import type { Evidence } from '../types.js';

/**
 * Get the line number of an AST node in its source file.
 */
export function getLineNumber(node: Node): number {
  return node.getStartLineNumber();
}

/**
 * Extract a few lines of context around a node for evidence readability.
 */
export function getContext(node: Node): string {
  const sourceFile = node.getSourceFile();
  const line = getLineNumber(node);
  const fullText = sourceFile.getFullText();
  const lines = fullText.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Create an evidence entry with standard field mapping.
 */
export function makeEvidence(
  file: string,
  node: Node,
  found: string,
  expected: string,
): Evidence {
  return {
    file,
    line: getLineNumber(node),
    found,
    expected,
    context: getContext(node),
  };
}
