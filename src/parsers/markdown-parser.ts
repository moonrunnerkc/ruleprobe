/**
 * Markdown instruction file parser.
 *
 * Takes raw markdown content and splits it into structured sections
 * based on headers. Each section captures the header text, depth,
 * raw body, and individual non-empty lines for downstream rule extraction.
 */

import type { MarkdownSection } from '../types.js';

const HEADER_PATTERN = /^(#{1,6})\s+(.+)$/;

/**
 * Parse a markdown string into structured sections split by headers.
 *
 * Every block of content under a header becomes a MarkdownSection.
 * Content before the first header (if any) is captured under a
 * synthetic section with header "" and depth 0.
 *
 * @param markdown - Raw markdown content to parse
 * @returns Array of parsed sections in document order
 */
export function parseMarkdown(markdown: string): MarkdownSection[] {
  const rawLines = markdown.split('\n');
  const sections: MarkdownSection[] = [];

  let currentHeader = '';
  let currentDepth = 0;
  let currentBodyLines: string[] = [];

  const flushSection = (): void => {
    const body = currentBodyLines.join('\n').trim();
    const lines = currentBodyLines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Only flush if we have a real header or non-empty body content
    if (currentHeader !== '' || body.length > 0) {
      sections.push({
        header: currentHeader,
        depth: currentDepth,
        body,
        lines,
      });
    }
  };

  for (const line of rawLines) {
    const headerMatch = HEADER_PATTERN.exec(line);

    if (headerMatch) {
      flushSection();
      currentHeader = headerMatch[2]?.trim() ?? '';
      currentDepth = headerMatch[1]?.length ?? 0;
      currentBodyLines = [];
    } else {
      currentBodyLines.push(line);
    }
  }

  // Flush the final section
  flushSection();

  return sections;
}

/**
 * Extract all non-empty, non-header lines from parsed sections.
 *
 * Useful for getting a flat list of all instruction content
 * regardless of section structure.
 *
 * @param sections - Parsed markdown sections
 * @returns All non-empty body lines across all sections
 */
export function flattenSectionLines(sections: MarkdownSection[]): string[] {
  return sections.flatMap((section) => section.lines);
}
