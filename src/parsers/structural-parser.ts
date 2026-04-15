/**
 * Pass 1: Structural markdown decomposition.
 *
 * Parses instruction file markdown into a tree of sections and typed
 * content blocks. Handles headers, bullets, numbered items, code blocks,
 * bold-prefixed lines, checkboxes, continuation lines, and nested lists.
 *
 * For non-markdown files (e.g. .rules), falls back to paragraph-per-line.
 */

import type {
  ContentBlock,
  Section,
  DocumentStructure,
  BulletBlock,
  NumberedBlock,
} from './pipeline-types.js';
import type { FlatBlock } from './structural-parser-helpers.js';
import {
  HEADER_RE,
  BULLET_RE,
  NUMBERED_RE,
  CHECKBOX_RE,
  BOLD_LINE_RE,
  CODE_FENCE_RE,
  joinContinuationLines,
  countContinuationLines,
  nestBulletBlock,
  flattenSections,
  flattenBlockChildren,
} from './structural-parser-helpers.js';

/**
 * Parse markdown content into a structured document tree.
 *
 * @param content - Raw markdown string
 * @returns Structured document with sections and typed content blocks
 */
export function parseStructuredMarkdown(content: string): DocumentStructure {
  const lines = content.split('\n');
  const preamble: ContentBlock[] = [];
  const topSections: Section[] = [];

  /** Stack of sections for nesting by header depth. */
  const sectionStack: Section[] = [];

  let currentBlocks: ContentBlock[] = preamble;
  let inCodeBlock = false;
  let codeFenceIndent = 0;
  let codeFenceMarker = '';
  let codeLanguage = '';
  let codeLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Handle code fence open/close
    if (inCodeBlock) {
      const closeMatch = CODE_FENCE_RE.exec(line);
      if (closeMatch && line.trim().startsWith(codeFenceMarker.charAt(0))
        && !closeMatch[3]) {
        const closeIndent = (closeMatch[1] ?? '').length;
        if (closeIndent <= codeFenceIndent) {
          currentBlocks.push({
            type: 'code_block',
            language: codeLanguage,
            content: codeLines.join('\n'),
            isInline: false,
          });
          inCodeBlock = false;
          codeLines = [];
          i++;
          continue;
        }
      }
      codeLines.push(line);
      i++;
      continue;
    }

    // Check for code fence opening
    const fenceMatch = CODE_FENCE_RE.exec(line);
    if (fenceMatch) {
      inCodeBlock = true;
      codeFenceIndent = (fenceMatch[1] ?? '').length;
      codeFenceMarker = fenceMatch[2] ?? '```';
      codeLanguage = fenceMatch[3] ?? '';
      codeLines = [];
      i++;
      continue;
    }

    // Check for header
    const headerMatch = HEADER_RE.exec(line);
    if (headerMatch) {
      const depth = (headerMatch[1] ?? '#').length;
      const header = (headerMatch[2] ?? '').trim();
      const newSection: Section = {
        header,
        depth,
        blocks: [],
        children: [],
      };

      // Pop stack until we find a parent with lower depth
      while (sectionStack.length > 0) {
        const top = sectionStack[sectionStack.length - 1];
        if (top && top.depth < depth) {
          break;
        }
        sectionStack.pop();
      }

      if (sectionStack.length === 0) {
        topSections.push(newSection);
      } else {
        const parent = sectionStack[sectionStack.length - 1];
        if (parent) {
          parent.children.push(newSection);
        }
      }

      sectionStack.push(newSection);
      currentBlocks = newSection.blocks;
      i++;
      continue;
    }

    // Blank line: skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      i++;
      continue;
    }

    // Blockquote: strip > prefix and parse as paragraph
    if (line.trimStart().startsWith('>')) {
      const text = line.replace(/^\s*>\s*/, '').trim();
      if (text.length > 0) {
        currentBlocks.push({ type: 'paragraph', text });
      }
      i++;
      continue;
    }

    // Checkbox
    const checkboxMatch = CHECKBOX_RE.exec(line);
    if (checkboxMatch) {
      const text = (checkboxMatch[3] ?? '').trim();
      const checked = (checkboxMatch[2] ?? ' ').toLowerCase() === 'x';
      currentBlocks.push({ type: 'checkbox', text, checked });
      i++;
      continue;
    }

    // Bullet list item
    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      const indent = (bulletMatch[1] ?? '').length;
      let text = (bulletMatch[3] ?? '').trim();

      // Check for continuation lines
      text = joinContinuationLines(lines, i, indent, text);
      const advanceCount = countContinuationLines(lines, i, indent);

      const block: BulletBlock = {
        type: 'bullet',
        text,
        indent,
        children: [],
      };

      // Nest under previous bullet if indented deeper
      nestBulletBlock(currentBlocks, block, indent);

      i += 1 + advanceCount;
      continue;
    }

    // Numbered list item
    const numberedMatch = NUMBERED_RE.exec(line);
    if (numberedMatch) {
      const indent = (numberedMatch[1] ?? '').length;
      const num = parseInt(numberedMatch[2] ?? '1', 10);
      let text = (numberedMatch[3] ?? '').trim();

      text = joinContinuationLines(lines, i, indent, text);
      const advanceCount = countContinuationLines(lines, i, indent);

      const block: NumberedBlock = {
        type: 'numbered',
        text,
        number: num,
        children: [],
      };
      currentBlocks.push(block);
      i += 1 + advanceCount;
      continue;
    }

    // Bold-prefixed line: **Label**: description
    const boldMatch = BOLD_LINE_RE.exec(line.trim());
    if (boldMatch) {
      const fullText = `${(boldMatch[1] ?? '').trim()}: ${(boldMatch[2] ?? '').trim()}`;
      currentBlocks.push({ type: 'bold_line', text: fullText });
      i++;
      continue;
    }

    // Plain paragraph
    let text = line.trim();
    // Join adjacent non-blank, non-structural lines into one paragraph
    const paraStart = i;
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (next.trim() === ''
        || HEADER_RE.test(next)
        || BULLET_RE.test(next)
        || NUMBERED_RE.test(next)
        || CHECKBOX_RE.test(next)
        || CODE_FENCE_RE.test(next)
        || /^[-*_]{3,}\s*$/.test(next.trim())
        || next.trimStart().startsWith('>')
        || BOLD_LINE_RE.test(next.trim())) {
        break;
      }
      text += ' ' + next.trim();
      i++;
    }
    if (text.length > 0 && paraStart < i) {
      currentBlocks.push({ type: 'paragraph', text });
    } else if (text.length > 0) {
      currentBlocks.push({ type: 'paragraph', text });
    }
  }

  // Flush unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    currentBlocks.push({
      type: 'code_block',
      language: codeLanguage,
      content: codeLines.join('\n'),
      isInline: false,
    });
  }

  return { sections: topSections, preamble };
}

/**
 * Parse plain text (non-markdown) into a flat document structure.
 * Each non-empty line becomes a paragraph block.
 * Lines starting with # are treated as headers.
 *
 * @param content - Raw plain text
 * @returns Document structure with one section per # header or flat paragraphs
 */
export function parsePlainText(content: string): DocumentStructure {
  // Plain text files (like zed .rules) can still use # headers
  // and * bullets. Reuse the markdown parser.
  return parseStructuredMarkdown(content);
}

/**
 * Flatten a document structure into all content blocks with section context.
 *
 * @param doc - The structured document from Pass 1
 * @returns Array of [block, sectionHeader, sectionDepth] tuples
 */
export function flattenBlocks(
  doc: DocumentStructure,
): FlatBlock[] {
  const result: FlatBlock[] = [];

  for (const block of doc.preamble) {
    flattenBlockChildren(block, '', 0, result);
  }

  flattenSections(doc.sections, result);

  return result;
}


