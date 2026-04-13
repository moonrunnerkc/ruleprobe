/**
 * Tests for tooling matcher extraction.
 *
 * Verifies that instructions about package managers, test frameworks,
 * and build tools are correctly extracted into tooling rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import type { MarkdownSection } from '../../src/types.js';

function makeSections(lines: string[]): MarkdownSection[] {
  return [{
    header: 'Tooling',
    level: 2,
    lines,
    codeBlocks: [],
  }];
}

describe('tooling matcher extraction', () => {
  beforeEach(() => {
    resetRuleCounter();
  });

  it('extracts "Use pnpm, not npm"', () => {
    const { rules } = extractRules(makeSections(['Use pnpm, not npm']));
    const match = rules.find((r) => r.id.includes('tooling-package-manager-pnpm'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('package-manager');
    expect(match!.pattern.target).toBe('pnpm');
  });

  it('extracts "Use yarn as package manager"', () => {
    const { rules } = extractRules(makeSections(['Use yarn as package manager']));
    const match = rules.find((r) => r.id.includes('tooling-package-manager-yarn'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('yarn');
  });

  it('extracts "Use vitest for testing"', () => {
    const { rules } = extractRules(makeSections(['Use vitest for testing']));
    const match = rules.find((r) => r.id.includes('tooling-test-framework-vitest'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('test-framework');
    expect(match!.pattern.target).toBe('vitest');
  });

  it('extracts "Use jest for tests"', () => {
    const { rules } = extractRules(makeSections(['Use jest for tests']));
    const match = rules.find((r) => r.id.includes('tooling-test-framework-jest'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('jest');
  });

  it('extracts "Use pytest for testing"', () => {
    const { rules } = extractRules(makeSections(['Use pytest for testing']));
    const match = rules.find((r) => r.id.includes('tooling-test-framework-pytest'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('pytest');
  });

  it('extracts "Use eslint for linting"', () => {
    const { rules } = extractRules(makeSections(['Use eslint for linting']));
    const match = rules.find((r) => r.id.includes('tooling-linter-eslint'));
    expect(match).toBeDefined();
    expect(match!.pattern.type).toBe('tool-present');
  });

  it('extracts "Use prettier for formatting"', () => {
    const { rules } = extractRules(makeSections(['Use prettier for formatting']));
    const match = rules.find((r) => r.id.includes('tooling-formatter-prettier'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('prettier');
  });

  it('extracts "Use biome for linting"', () => {
    const { rules } = extractRules(makeSections(['Use biome for linting']));
    const match = rules.find((r) => r.id.includes('tooling-formatter-biome'));
    expect(match).toBeDefined();
    expect(match!.pattern.target).toBe('biome');
  });

  it('sets category to tooling', () => {
    const { rules } = extractRules(makeSections(['Use pnpm, not npm']));
    const match = rules.find((r) => r.id.includes('tooling'));
    expect(match).toBeDefined();
    expect(match!.category).toBe('tooling');
  });

  it('sets verifier to tooling', () => {
    const { rules } = extractRules(makeSections(['Use vitest for testing']));
    const match = rules.find((r) => r.id.includes('tooling'));
    expect(match).toBeDefined();
    expect(match!.verifier).toBe('tooling');
  });
});
