/**
 * Tests for Pass 1: Structural markdown decomposition.
 *
 * Tests the structural parser against 10 real corpus files covering
 * complex nesting, code blocks, plain text, and minimal files.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseStructuredMarkdown,
  flattenBlocks,
} from '../../src/parsers/structural-parser.js';
import type { ContentBlock, Section } from '../../src/parsers/pipeline-types.js';

const corpusDir = resolve(__dirname, '../fixtures/corpus');

function readCorpus(name: string): string {
  return readFileSync(resolve(corpusDir, name), 'utf-8');
}

function countBlockType(
  blocks: Array<{ block: ContentBlock }>,
  type: ContentBlock['type'],
): number {
  return blocks.filter((b) => b.block.type === type).length;
}

function allSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  for (const s of sections) {
    result.push(s);
    result.push(...allSections(s.children));
  }
  return result;
}

describe('structural parser: actual-AGENTS.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('actual-AGENTS.md'));
  const flat = flattenBlocks(doc);

  it('produces top-level sections', () => {
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('captures nested sections', () => {
    const all = allSections(doc.sections);
    expect(all.length).toBeGreaterThan(doc.sections.length);
  });

  it('extracts code blocks', () => {
    const codeBlocks = countBlockType(flat, 'code_block');
    expect(codeBlocks).toBeGreaterThan(0);
  });

  it('extracts bullet items', () => {
    const bullets = countBlockType(flat, 'bullet');
    expect(bullets).toBeGreaterThan(20);
  });

  it('captures bold-prefixed lines', () => {
    const bolds = countBlockType(flat, 'bold_line');
    expect(bolds).toBeGreaterThan(0);
  });

  it('captures numbered list items', () => {
    const numbered = countBlockType(flat, 'numbered');
    expect(numbered).toBeGreaterThan(0);
  });

  it('total blocks exceeds 100', () => {
    expect(flat.length).toBeGreaterThan(100);
  });
});

describe('structural parser: nextjs-AGENTS.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('nextjs-AGENTS.md'));
  const flat = flattenBlocks(doc);

  it('extracts many code blocks for commands', () => {
    const codeBlocks = countBlockType(flat, 'code_block');
    expect(codeBlocks).toBeGreaterThan(5);
  });

  it('code blocks have language tags', () => {
    const codeItems = flat.filter((b) => b.block.type === 'code_block');
    const withLang = codeItems.filter(
      (b) => b.block.type === 'code_block' && b.block.language.length > 0,
    );
    expect(withLang.length).toBeGreaterThan(0);
  });

  it('captures section headers at multiple depths', () => {
    const all = allSections(doc.sections);
    const depths = new Set(all.map((s) => s.depth));
    expect(depths.size).toBeGreaterThan(1);
  });

  it('captures paragraphs', () => {
    const paras = countBlockType(flat, 'paragraph');
    expect(paras).toBeGreaterThan(5);
  });
});

describe('structural parser: excalidraw-CLAUDE.md (minimal)', () => {
  const doc = parseStructuredMarkdown(readCorpus('excalidraw-CLAUDE.md'));
  const flat = flattenBlocks(doc);

  it('has a few sections', () => {
    const all = allSections(doc.sections);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('has code blocks with bash language', () => {
    const codeItems = flat.filter(
      (b) => b.block.type === 'code_block' && b.block.language === 'bash',
    );
    expect(codeItems.length).toBeGreaterThan(0);
  });

  it('captures bullet items for project structure', () => {
    const bullets = countBlockType(flat, 'bullet');
    expect(bullets).toBeGreaterThan(2);
  });
});

describe('structural parser: vscode-copilot.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('vscode-copilot.md'));
  const flat = flattenBlocks(doc);

  it('captures nested bullet lists', () => {
    const bullets = flat.filter((b) => b.block.type === 'bullet');
    expect(bullets.length).toBeGreaterThan(10);
  });

  it('captures sections for each guideline category', () => {
    const all = allSections(doc.sections);
    const headers = all.map((s) => s.header.toLowerCase());
    expect(headers.some((h) => h.includes('naming'))).toBe(true);
    expect(headers.some((h) => h.includes('style') || h.includes('quality'))).toBe(true);
  });

  it('code blocks contain typescript examples', () => {
    const tsBlocks = flat.filter(
      (b) => b.block.type === 'code_block' && b.block.language === 'typescript',
    );
    expect(tsBlocks.length).toBeGreaterThan(0);
  });
});

describe('structural parser: zed-rules.txt (plain text)', () => {
  const doc = parseStructuredMarkdown(readCorpus('zed-rules.txt'));
  const flat = flattenBlocks(doc);

  it('parses # headers as sections', () => {
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('captures bullet items from * markers', () => {
    const bullets = countBlockType(flat, 'bullet');
    expect(bullets).toBeGreaterThan(10);
  });

  it('handles nested bullet children', () => {
    const allBullets = flat.filter((b) => b.block.type === 'bullet');
    const nested = allBullets.filter(
      (b) => b.block.type === 'bullet' && b.block.indent > 0,
    );
    expect(nested.length).toBeGreaterThan(0);
  });

  it('captures code blocks within list items', () => {
    const codeBlocks = countBlockType(flat, 'code_block');
    expect(codeBlocks).toBeGreaterThan(0);
  });
});

describe('structural parser: tldraw-CLAUDE.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('tldraw-CLAUDE.md'));
  const flat = flattenBlocks(doc);

  it('captures section hierarchy', () => {
    const all = allSections(doc.sections);
    expect(all.length).toBeGreaterThan(5);
  });

  it('finds bold-prefixed lines for package descriptions', () => {
    const bolds = countBlockType(flat, 'bold_line');
    expect(bolds).toBeGreaterThan(0);
  });
});

describe('structural parser: twenty-CLAUDE.md (deep nesting)', () => {
  const doc = parseStructuredMarkdown(readCorpus('twenty-CLAUDE.md'));
  const flat = flattenBlocks(doc);

  it('captures deeply nested sections', () => {
    const all = allSections(doc.sections);
    const maxDepth = Math.max(...all.map((s) => s.depth));
    expect(maxDepth).toBeGreaterThanOrEqual(3);
  });

  it('has many code blocks for commands', () => {
    const codeBlocks = countBlockType(flat, 'code_block');
    expect(codeBlocks).toBeGreaterThan(3);
  });
});

describe('structural parser: electron-CLAUDE.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('electron-CLAUDE.md'));
  const flat = flattenBlocks(doc);

  it('captures sections', () => {
    const all = allSections(doc.sections);
    expect(all.length).toBeGreaterThan(3);
  });

  it('has both bullets and code blocks', () => {
    expect(countBlockType(flat, 'bullet')).toBeGreaterThan(5);
    expect(countBlockType(flat, 'code_block')).toBeGreaterThan(0);
  });
});

describe('structural parser: prometheus-AGENTS.md', () => {
  const doc = parseStructuredMarkdown(readCorpus('prometheus-AGENTS.md'));
  const flat = flattenBlocks(doc);

  it('has Go-specific sections', () => {
    const all = allSections(doc.sections);
    const headers = all.map((s) => s.header);
    expect(headers.some((h) => /test|perf|code|commit/i.test(h))).toBe(true);
  });

  it('handles horizontal rules as section separators', () => {
    // Horizontal rules are skipped, they should not appear as blocks
    const paras = flat.filter(
      (b) => b.block.type === 'paragraph' && b.block.text === '---',
    );
    expect(paras.length).toBe(0);
  });
});

describe('structural parser: react-CLAUDE.md (minimal)', () => {
  const doc = parseStructuredMarkdown(readCorpus('react-CLAUDE.md'));

  it('produces a small number of sections', () => {
    const all = allSections(doc.sections);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.length).toBeLessThan(10);
  });

  it('captures the few bullet items', () => {
    const flat = flattenBlocks(doc);
    const bullets = countBlockType(flat, 'bullet');
    expect(bullets).toBeGreaterThanOrEqual(1);
  });
});

describe('structural parser: continuation lines', () => {
  it('joins wrapped bullet text on continuation lines', () => {
    const md = `# Section

- This is a long bullet point that
  continues on the next line
- Short bullet`;

    const doc = parseStructuredMarkdown(md);
    const flat = flattenBlocks(doc);
    const bullets = flat.filter((b) => b.block.type === 'bullet');
    expect(bullets.length).toBe(2);
    expect(bullets[0]?.block.type === 'bullet' && bullets[0].block.text).toContain('continues');
  });
});

describe('structural parser: empty document', () => {
  it('handles empty string without error', () => {
    const doc = parseStructuredMarkdown('');
    expect(doc.sections).toHaveLength(0);
    expect(doc.preamble).toHaveLength(0);
  });
});

describe('structural parser: preamble before first header', () => {
  it('captures preamble text', () => {
    const md = `Some preamble text here.

# First Section

Content under section.`;

    const doc = parseStructuredMarkdown(md);
    expect(doc.preamble.length).toBeGreaterThan(0);
    expect(doc.sections.length).toBe(1);
  });
});
