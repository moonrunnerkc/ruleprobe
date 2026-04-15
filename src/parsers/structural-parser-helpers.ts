/**
 * Structural parser helper functions and regex constants.
 *
 * Extracted from structural-parser.ts for the 300-line file limit.
 * Contains: regex patterns, continuation line helpers, bullet nesting.
 */

import type { ContentBlock, BulletBlock, Section } from './pipeline-types.js';

/** Matches markdown headers: # through ###### */
export const HEADER_RE = /^(#{1,6})\s+(.+)$/;

/** Matches unordered list items with optional indentation. */
export const BULLET_RE = /^(\s*)([-*+])\s+(.*)$/;

/** Matches ordered list items with optional indentation. */
export const NUMBERED_RE = /^(\s*)(\d+)\.\s+(.*)$/;

/** Matches checkbox items: - [x] or - [ ]. */
export const CHECKBOX_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/;

/** Matches bold-prefixed lines: **Label**: description. */
export const BOLD_LINE_RE = /^\*\*([^*]+)\*\*[:\s]+(.+)$/;

/** Matches fenced code block delimiters. */
export const CODE_FENCE_RE = /^(\s*)(`{3,}|~{3,})(\w*)\s*$/;

/**
 * Join continuation lines (wrapped text belonging to a list item).
 * A continuation line is indented beyond the item marker and is not
 * itself a new list item, header, code fence, or blank line.
 *
 * @param lines - All document lines
 * @param startIndex - Index of the list item line
 * @param itemIndent - Indentation level of the list item
 * @param initialText - Already-parsed text from the list item line
 * @returns Combined text of item plus continuations
 */
export function joinContinuationLines(
  lines: string[],
  startIndex: number,
  itemIndent: number,
  initialText: string,
): string {
  let text = initialText;
  let j = startIndex + 1;
  const continuationIndent = itemIndent + 2;

  while (j < lines.length) {
    const next = lines[j] ?? '';
    if (next.trim() === '') break;
    if (HEADER_RE.test(next)) break;
    if (CODE_FENCE_RE.test(next)) break;
    const nextBullet = BULLET_RE.exec(next);
    if (nextBullet) {
      const nextIndent = (nextBullet[1] ?? '').length;
      if (nextIndent <= itemIndent) break;
      break;
    }
    const nextNumbered = NUMBERED_RE.exec(next);
    if (nextNumbered) {
      const nextIndent = (nextNumbered[1] ?? '').length;
      if (nextIndent <= itemIndent) break;
      break;
    }
    const lineIndent = next.length - next.trimStart().length;
    if (lineIndent < continuationIndent) break;

    text += ' ' + next.trim();
    j++;
  }
  return text;
}

/**
 * Count how many continuation lines follow a list item.
 *
 * @param lines - All document lines
 * @param startIndex - Index of the list item line
 * @param itemIndent - Indentation level of the list item
 * @returns Number of continuation lines
 */
export function countContinuationLines(
  lines: string[],
  startIndex: number,
  itemIndent: number,
): number {
  let count = 0;
  let j = startIndex + 1;
  const continuationIndent = itemIndent + 2;

  while (j < lines.length) {
    const next = lines[j] ?? '';
    if (next.trim() === '') break;
    if (HEADER_RE.test(next)) break;
    if (CODE_FENCE_RE.test(next)) break;
    const nextBullet = BULLET_RE.exec(next);
    if (nextBullet) {
      const nextIndent = (nextBullet[1] ?? '').length;
      if (nextIndent <= itemIndent) break;
      break;
    }
    const nextNumbered = NUMBERED_RE.exec(next);
    if (nextNumbered) {
      const nextIndent = (nextNumbered[1] ?? '').length;
      if (nextIndent <= itemIndent) break;
      break;
    }
    const lineIndent = next.length - next.trimStart().length;
    if (lineIndent < continuationIndent) break;
    count++;
    j++;
  }
  return count;
}

/**
 * Nest a bullet block under a previous bullet if it is more indented.
 * Otherwise appends to the current blocks list.
 *
 * @param currentBlocks - The block list to append to
 * @param block - The bullet block to nest or append
 * @param indent - The indentation level of the new block
 */
export function nestBulletBlock(
  currentBlocks: ContentBlock[],
  block: BulletBlock,
  indent: number,
): void {
  if (indent > 0 && currentBlocks.length > 0) {
    const last = currentBlocks[currentBlocks.length - 1];
    if (last && last.type === 'bullet' && last.indent < indent) {
      last.children.push(block);
      return;
    }
  }
  currentBlocks.push(block);
}

/** Type alias for flatten output tuples. */
export type FlatBlock = { block: ContentBlock; sectionHeader: string; sectionDepth: number };

/**
 * Recursively collect blocks from nested sections.
 *
 * @param sections - Sections to flatten
 * @param out - Output array to append to
 */
export function flattenSections(
  sections: Section[],
  out: FlatBlock[],
): void {
  for (const section of sections) {
    for (const block of section.blocks) {
      flattenBlockChildren(block, section.header, section.depth, out);
    }
    flattenSections(section.children, out);
  }
}

/**
 * Add a block and recursively add its children (for nested lists).
 *
 * @param block - The block to add
 * @param sectionHeader - The section header context
 * @param sectionDepth - The section depth
 * @param out - Output array to append to
 */
export function flattenBlockChildren(
  block: ContentBlock,
  sectionHeader: string,
  sectionDepth: number,
  out: FlatBlock[],
): void {
  out.push({ block, sectionHeader, sectionDepth });
  if ('children' in block && block.children) {
    for (const child of block.children) {
      flattenBlockChildren(child, sectionHeader, sectionDepth, out);
    }
  }
}
