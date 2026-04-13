/**
 * Tests for preference matcher extraction.
 *
 * Verifies that "prefer X over Y" patterns in instruction text
 * are correctly extracted and mapped to prefer-pair verifications.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import type { MarkdownSection } from '../../src/types.js';

beforeEach(() => {
  resetRuleCounter();
});

function extractFromLine(line: string) {
  const sections: MarkdownSection[] = [{
    header: 'Rules',
    depth: 2,
    body: `- ${line}`,
    lines: [`- ${line}`],
  }];
  return extractRules(sections);
}

describe('preference matcher extraction', () => {
  it('extracts "Prefer const over let"', () => {
    const { rules } = extractFromLine('Prefer const over let');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('const-vs-let');
  });

  it('extracts "Use const instead of let"', () => {
    const { rules } = extractFromLine('Use const instead of let');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('const-vs-let');
  });

  it('extracts "Prefer named exports over default exports"', () => {
    const { rules } = extractFromLine('Prefer named exports over default exports');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('named-vs-default-exports');
  });

  it('extracts "Prefer interface over type for object shapes"', () => {
    const { rules } = extractFromLine('Prefer interface over type for object shapes');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('interface-vs-type');
  });

  it('extracts "Prefer async/await over .then() chains"', () => {
    const { rules } = extractFromLine('Prefer async/await over .then() chains');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('async-await-vs-then');
  });

  it('extracts "Prefer arrow functions over function declarations"', () => {
    const { rules } = extractFromLine('Prefer arrow functions over function declarations');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('arrow-vs-function-declarations');
  });

  it('extracts "Prefer template literals over string concatenation"', () => {
    const { rules } = extractFromLine('Prefer template literals over string concatenation');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('template-literals-vs-concatenation');
  });

  it('extracts "Prefer optional chaining"', () => {
    const { rules } = extractFromLine('Prefer optional chaining over nested conditionals');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('optional-chaining-vs-nested-conditionals');
  });

  it('extracts "Prefer functional components over class components"', () => {
    const { rules } = extractFromLine('Prefer functional components over class components');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref).toBeDefined();
    expect(pref!.pattern.target).toBe('functional-vs-class-components');
  });

  it('sets verifier to preference', () => {
    const { rules } = extractFromLine('Prefer const over let');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref!.verifier).toBe('preference');
  });

  it('sets qualifier to prefer for preference rules', () => {
    const { rules } = extractFromLine('Prefer const over let');
    const pref = rules.find((r) => r.category === 'preference');
    expect(pref!.qualifier).toBe('prefer');
  });
});
