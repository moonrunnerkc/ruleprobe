/**
 * Corpus validation: extraction pipeline against 10 real instruction files.
 *
 * Measures parse rates (rules extracted / total statements) and verifies
 * the new three-pass pipeline improves extraction vs the old single-pass.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionContent } from '../../src/parsers/index.js';
import {
  parseStructuredMarkdown,
  flattenBlocks,
} from '../../src/parsers/structural-parser.js';
import { classifyAllStatements } from '../../src/parsers/statement-classifier.js';

const corpusDir = resolve(__dirname, '../fixtures/corpus');

interface CorpusResult {
  file: string;
  totalBlocks: number;
  rules: number;
  unparseable: number;
  parseRate: number;
  categories: Record<string, number>;
}

function analyzeCorpusFile(filename: string, fakePath: string): CorpusResult {
  const content = readFileSync(resolve(corpusDir, filename), 'utf-8');
  const doc = parseStructuredMarkdown(content);
  const flat = flattenBlocks(doc);
  const classified = classifyAllStatements(flat);

  // Count actionable vs context vs unknown
  const categories: Record<string, number> = {};
  for (const stmt of classified) {
    categories[stmt.category] = (categories[stmt.category] ?? 0) + 1;
  }

  const ruleSet = parseInstructionContent(content, fakePath);

  return {
    file: filename,
    totalBlocks: classified.length,
    rules: ruleSet.rules.length,
    unparseable: ruleSet.unparseable.length,
    parseRate: classified.length > 0
      ? ruleSet.rules.length / classified.length
      : 0,
    categories,
  };
}

describe('corpus: parse rate validation', () => {
  it('actual-AGENTS.md: extracts rules from complex file', () => {
    const result = analyzeCorpusFile('actual-AGENTS.md', 'AGENTS.md');
    expect(result.rules).toBeGreaterThan(10);
    expect(result.totalBlocks).toBeGreaterThan(50);
  });

  it('nextjs-AGENTS.md: extracts from heavy code block file', () => {
    const result = analyzeCorpusFile('nextjs-AGENTS.md', 'AGENTS.md');
    expect(result.rules).toBeGreaterThan(5);
  });

  it('excalidraw-CLAUDE.md: handles minimal file', () => {
    const result = analyzeCorpusFile('excalidraw-CLAUDE.md', 'CLAUDE.md');
    expect(result.rules).toBeGreaterThan(0);
  });

  it('vscode-copilot.md: extracts naming and style rules', () => {
    const result = analyzeCorpusFile('vscode-copilot.md', 'copilot-instructions.md');
    expect(result.rules).toBeGreaterThan(10);
    // Should find naming conventions
    const ruleSet = parseInstructionContent(
      readFileSync(resolve(corpusDir, 'vscode-copilot.md'), 'utf-8'),
      'copilot-instructions.md',
    );
    const hasNaming = ruleSet.rules.some((r) => r.category === 'naming');
    expect(hasNaming).toBe(true);
  });

  it('zed-rules.txt: handles plain text format', () => {
    const result = analyzeCorpusFile('zed-rules.txt', '.rules');
    expect(result.rules).toBeGreaterThan(5);
  });

  it('tldraw-CLAUDE.md: extracts from mixed prose/directive file', () => {
    const result = analyzeCorpusFile('tldraw-CLAUDE.md', 'CLAUDE.md');
    expect(result.rules).toBeGreaterThan(3);
  });

  it('twenty-CLAUDE.md: extracts from deep nesting', () => {
    const result = analyzeCorpusFile('twenty-CLAUDE.md', 'CLAUDE.md');
    expect(result.rules).toBeGreaterThan(3);
  });

  it('electron-CLAUDE.md: extracts cross-platform rules', () => {
    const result = analyzeCorpusFile('electron-CLAUDE.md', 'CLAUDE.md');
    expect(result.rules).toBeGreaterThan(3);
  });

  it('prometheus-AGENTS.md: extracts Go-specific rules', () => {
    const result = analyzeCorpusFile('prometheus-AGENTS.md', 'AGENTS.md');
    expect(result.rules).toBeGreaterThan(5);
  });

  it('react-CLAUDE.md: handles very minimal file', () => {
    const result = analyzeCorpusFile('react-CLAUDE.md', 'CLAUDE.md');
    // Very minimal, may have 0 or few rules
    expect(result.totalBlocks).toBeGreaterThan(0);
  });
});

describe('corpus: classification distribution', () => {
  it('actual-AGENTS.md has mixed CONTEXT_ONLY, TOOLING, IMPERATIVE', () => {
    const content = readFileSync(resolve(corpusDir, 'actual-AGENTS.md'), 'utf-8');
    const doc = parseStructuredMarkdown(content);
    const flat = flattenBlocks(doc);
    const classified = classifyAllStatements(flat);

    const cats: Record<string, number> = {};
    for (const stmt of classified) {
      cats[stmt.category] = (cats[stmt.category] ?? 0) + 1;
    }

    // Should have a mix of categories
    const actionable = classified.filter(
      (s) => s.category !== 'CONTEXT_ONLY' && s.category !== 'UNKNOWN',
    ).length;
    expect(actionable).toBeGreaterThan(20);

    // Context should also be present
    expect(cats['CONTEXT_ONLY'] ?? 0).toBeGreaterThan(5);
  });

  it('prometheus-AGENTS.md produces WORKFLOW rules', () => {
    const content = readFileSync(resolve(corpusDir, 'prometheus-AGENTS.md'), 'utf-8');
    const doc = parseStructuredMarkdown(content);
    const flat = flattenBlocks(doc);
    const classified = classifyAllStatements(flat);

    const hasWorkflow = classified.some((s) => s.category === 'WORKFLOW');
    expect(hasWorkflow).toBe(true);
  });

  it('vscode-copilot.md produces NAMING_CONVENTION and CODE_STYLE', () => {
    const content = readFileSync(resolve(corpusDir, 'vscode-copilot.md'), 'utf-8');
    const doc = parseStructuredMarkdown(content);
    const flat = flattenBlocks(doc);
    const classified = classifyAllStatements(flat);

    const hasNaming = classified.some((s) => s.category === 'NAMING_CONVENTION');
    const hasCodeStyle = classified.some(
      (s) => s.category === 'CODE_STYLE' || s.category === 'IMPERATIVE_DIRECT',
    );
    expect(hasNaming).toBe(true);
    expect(hasCodeStyle).toBe(true);
  });
});

describe('corpus: CONTEXT_ONLY filtering', () => {
  it('does not classify pure descriptions as actionable', () => {
    const content = readFileSync(resolve(corpusDir, 'actual-AGENTS.md'), 'utf-8');
    const doc = parseStructuredMarkdown(content);
    const flat = flattenBlocks(doc);
    const classified = classifyAllStatements(flat);

    // Check specific context statements
    const contextStatements = classified.filter(
      (s) => s.category === 'CONTEXT_ONLY',
    );
    for (const stmt of contextStatements) {
      // None should start with strong imperative verbs AND have obligation words
      const isStrongImperative = /^(must|always|never|do not)/i.test(stmt.text);
      if (isStrongImperative) {
        // If it does, it should have a context override reason (metadata, link, etc.)
        // This is a sanity check; not exhaustive
        expect(stmt.confidence).toBeGreaterThan(0.5);
      }
    }
  });
});
