/**
 * AST visitor logic for the local extractor.
 *
 * Contains the recursive tree visitor, canonical shape computation,
 * deviation comment detection, and node classification functions.
 * Separated from local-extractor.ts to keep files under 300 lines.
 */

import { createHash } from 'node:crypto';
import type { TreeSitterNode } from '../verifier/treesitter-loader.js';

/** Key prefix for boolean structural flags encoded in nodeTypeCounts. */
export const FLAG_PREFIX = '__flag:';

/** Flag key for deviation comments (TODO/HACK/FIXME/legacy/workaround/intentional). */
export const DEVIATION_COMMENT_FLAG = `${FLAG_PREFIX}deviationComment`;

/** Flag key for test code detection. */
export const TEST_CODE_FLAG = `${FLAG_PREFIX}testCode`;

/**
 * Pattern matching deviation keywords in comments.
 * Matches TODO, HACK, FIXME, legacy, workaround, intentional (case-insensitive).
 */
const DEVIATION_COMMENT_PATTERN =
  /\b(TODO|HACK|FIXME|legacy|workaround|intentional)\b/i;

/** Accumulator for tracking average nesting depth per node type. */
export interface DepthAccumulator {
  total: number;
  count: number;
}

/**
 * Recursively visit an AST node, counting types, tracking depths,
 * and hashing sub-tree shapes for structural signatures.
 *
 * @param node - Current AST node
 * @param depth - Current depth in the tree
 * @param counts - Accumulator for node type counts
 * @param depthAccumulators - Accumulator for nesting depth averages
 * @param subTreeHashes - Accumulator for unique sub-tree signature hashes
 */
export function visitNode(
  node: TreeSitterNode,
  depth: number,
  counts: Record<string, number>,
  depthAccumulators: Record<string, DepthAccumulator>,
  subTreeHashes: string[],
): void {
  const nodeType = node.type;
  counts[nodeType] = (counts[nodeType] ?? 0) + 1;

  if (isDepthTrackedType(nodeType)) {
    const acc = depthAccumulators[nodeType] ?? { total: 0, count: 0 };
    acc.total += depth;
    acc.count += 1;
    depthAccumulators[nodeType] = acc;
  }

  if (isSignatureNode(nodeType) && node.childCount > 0) {
    const shape = canonicalShape(node);
    const hash = sha256(shape);
    if (!subTreeHashes.includes(hash)) {
      subTreeHashes.push(hash);
    }
  }

  for (const child of node.children) {
    visitNode(child, depth + 1, counts, depthAccumulators, subTreeHashes);
  }
}

/** Node types whose nesting depth is tracked. */
function isDepthTrackedType(type: string): boolean {
  return (
    type === 'try_statement' ||
    type === 'catch_clause' ||
    type === 'for_statement' ||
    type === 'for_in_statement' ||
    type === 'while_statement' ||
    type === 'do_statement' ||
    type === 'if_statement' ||
    type === 'function_declaration' ||
    type === 'arrow_function' ||
    type === 'method_definition'
  );
}

/** Node types that produce structural signatures via sub-tree hashing. */
function isSignatureNode(type: string): boolean {
  return (
    type === 'function_declaration' ||
    type === 'arrow_function' ||
    type === 'method_definition' ||
    type === 'class_declaration' ||
    type === 'try_statement' ||
    type === 'export_statement'
  );
}

/**
 * Compute canonical shape string for a sub-tree.
 * Uses node types only (no code text) to produce a structural fingerprint.
 *
 * @param node - Root of the sub-tree
 * @returns Canonical shape string (node types only, no source code)
 */
export function canonicalShape(node: TreeSitterNode): string {
  if (node.childCount === 0) {
    return node.type;
  }
  const childShapes = node.children
    .map((c) => canonicalShape(c))
    .join(',');
  return `${node.type}(${childShapes})`;
}

/**
 * Check whether any comment in the AST contains a deviation keyword.
 *
 * @param root - Root node of the parsed AST
 * @returns True if a deviation comment was found
 */
export function hasDeviationComment(root: TreeSitterNode): boolean {
  return checkCommentNodes(root);
}

/**
 * Recursively search for comment nodes containing deviation keywords.
 */
function checkCommentNodes(node: TreeSitterNode): boolean {
  if (node.type === 'comment' && DEVIATION_COMMENT_PATTERN.test(node.text)) {
    return true;
  }
  for (const child of node.children) {
    if (checkCommentNodes(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Compute SHA-256 hash of a string.
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 digest
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
