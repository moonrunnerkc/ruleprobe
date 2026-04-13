/**
 * Tests for file-structure matcher extraction.
 *
 * Verifies that instruction lines about directory structure,
 * file existence, and module organization are correctly identified
 * and converted to verification patterns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import type { MarkdownSection } from '../../src/types.js';

function makeSections(lines: string[]): MarkdownSection[] {
  return [{
    header: 'Project Structure',
    level: 2,
    lines,
    codeBlocks: [],
  }];
}

describe('file-structure matcher extraction', () => {
  beforeEach(() => {
    resetRuleCounter();
  });

  it('extracts "Tests go in __tests__/"', () => {
    const sections = makeSections(['Tests go in __tests__/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-tests-dir'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('directory-exists-with-files');
  });

  it('extracts "Test files in tests/"', () => {
    const sections = makeSections(['Test files in tests/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-tests-dir'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('tests/');
  });

  it('extracts "Components live in src/components/"', () => {
    const sections = makeSections(['Components live in src/components/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-components-dir'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('directory-exists-with-files');
    expect(match!.pattern.target).toBe('src/components/');
  });

  it('extracts "Use .env.local for local config"', () => {
    const sections = makeSections(['Use .env.local for local config']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-env-file'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('file-pattern-exists');
    expect(match!.pattern.target).toBe('.env.local');
  });

  it('extracts "Every module needs an index.ts"', () => {
    const sections = makeSections(['Every module needs an index.ts']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-module-index'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('module-index-required');
    expect(match!.pattern.target).toBe('index.ts');
  });

  it('extracts "Source code in src/" pattern', () => {
    const sections = makeSections(['Source code in src/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure-src-dir'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('directory-exists-with-files');
    expect(match!.pattern.target).toBe('src');
  });

  it('sets category to file-structure', () => {
    const sections = makeSections(['Tests go in __tests__/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure'));
    expect(match).toBeDefined();
    expect(match!.category).toBe('file-structure');
  });

  it('sets verifier to filesystem', () => {
    const sections = makeSections(['Components live in src/components/']);
    const { rules } = extractRules(sections);
    const match = rules.find((r) => r.id.includes('file-structure'));
    expect(match).toBeDefined();
    expect(match!.verifier).toBe('filesystem');
  });
});
