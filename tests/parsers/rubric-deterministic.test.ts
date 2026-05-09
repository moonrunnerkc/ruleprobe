/**
 * Tests for deterministic rubric decomposition.
 *
 * Verifies that subjective phrases produce real, verifiable rules
 * without any LLM or network call, and that rules carry the correct
 * extractionMethod and confidence tags.
 */

import { describe, it, expect } from 'vitest';
import {
  runDeterministicRubric,
  listRubrics,
} from '../../src/parsers/rubric-deterministic.js';
import { parseInstructionContent } from '../../src/parsers/index.js';

describe('runDeterministicRubric', () => {
  it('decomposes "write clean code" into multiple proxy rules', () => {
    const result = runDeterministicRubric(['Write clean code.'], new Set());

    expect(result.rules.length).toBeGreaterThanOrEqual(5);
    expect(result.remaining).toEqual([]);

    for (const rule of result.rules) {
      expect(rule.extractionMethod).toBe('rubric-deterministic');
      expect(rule.confidence).toBe('medium');
      expect(rule.severity).toBe('warning');
      expect(rule.source).toBe('Write clean code.');
      expect(rule.rubricWeight).toBeGreaterThan(0);
      expect(rule.rubricWeight).toBeLessThanOrEqual(1);
    }
  });

  it('expands "keep it simple" into proxy rules', () => {
    const result = runDeterministicRubric(['Keep it simple.'], new Set());

    expect(result.rules.length).toBeGreaterThan(0);
    const ids = new Set(result.rules.map((r) => r.id));
    expect([...ids].some((id) => id.includes('keep-it-simple'))).toBe(true);
  });

  it('expands "small files" into a max-file-length proxy', () => {
    const result = runDeterministicRubric(['Keep files small.'], new Set());

    const fileLengthRule = result.rules.find(
      (r) => r.pattern.type === 'max-file-length',
    );
    expect(fileLengthRule).toBeDefined();
    expect(fileLengthRule?.verifier).toBe('filesystem');
  });

  it('expands "be explicit" into type-safety proxies', () => {
    const result = runDeterministicRubric(['Be explicit with types.'], new Set());

    const noAnyRule = result.rules.find((r) => r.pattern.type === 'no-any');
    expect(noAnyRule).toBeDefined();
    expect(noAnyRule?.category).toBe('type-safety');
  });

  it('returns lines that match no rubric in `remaining`', () => {
    const result = runDeterministicRubric(['Use semantic versioning.'], new Set());

    expect(result.rules).toEqual([]);
    expect(result.remaining).toEqual(['Use semantic versioning.']);
  });

  it('skips rule ids that already exist', () => {
    const existing = new Set<string>();
    const first = runDeterministicRubric(['Write clean code.'], existing);
    for (const r of first.rules) {
      existing.add(r.id);
    }

    const second = runDeterministicRubric(['Write clean code.'], existing);
    expect(second.rules).toEqual([]);
  });

  it('produces stable, deterministic ids across runs', () => {
    const a = runDeterministicRubric(['Write clean code.'], new Set());
    const b = runDeterministicRubric(['Write clean code.'], new Set());
    const idsA = a.rules.map((r) => r.id).sort();
    const idsB = b.rules.map((r) => r.id).sort();
    expect(idsA).toEqual(idsB);
  });

  it('weights inside a single rubric sum to ~1.0', () => {
    for (const rubric of listRubrics()) {
      const total = rubric.checks.reduce((sum, c) => sum + c.weight, 0);
      expect(Math.abs(total - 1)).toBeLessThan(0.001);
    }
  });
});

describe('parser integration with deterministic rubric', () => {
  it('parseInstructionContent produces rubric rules without any flag', () => {
    const content = `# Project rules

- Write clean code.
- Use camelCase for variables.
`;
    const ruleSet = parseInstructionContent(content, 'CLAUDE.md');

    const rubricRules = ruleSet.rules.filter(
      (r) => r.extractionMethod === 'rubric-deterministic',
    );
    expect(rubricRules.length).toBeGreaterThan(0);
    expect(ruleSet.unparseable.find((l) => /clean\s+code/i.test(l))).toBeUndefined();
  });
});
