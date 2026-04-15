/**
 * Tests for structural delta computation.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureVector } from '../../../../src/semantic/types.js';
import { computeDelta, formatDelta } from '../../../../src/semantic/engine/comparison/structural-delta.js';

function makeVector(
  counts: Record<string, number>,
  sigs: string[],
): FeatureVector {
  return {
    nodeTypeCounts: counts,
    nestingDepths: {},
    patternSignatures: sigs,
    prevalence: 0.5,
    compositePatterns: {},
  };
}

describe('computeDelta', () => {
  it('returns empty delta for identical vectors', () => {
    const v = makeVector({ a: 5 }, ['s1']);
    const delta = computeDelta(v, v);
    expect(delta.missingFromTarget.length).toBe(0);
    expect(delta.extraInTarget.length).toBe(0);
    expect(delta.missingSignatures.length).toBe(0);
    expect(delta.extraSignatures.length).toBe(0);
  });

  it('detects missing node types', () => {
    const profile = makeVector({ a: 5, b: 3 }, []);
    const target = makeVector({ a: 5 }, []);
    const delta = computeDelta(profile, target);
    expect(delta.missingFromTarget.length).toBe(1);
    expect(delta.missingFromTarget[0]?.nodeType).toBe('b');
    expect(delta.missingFromTarget[0]?.expectedCount).toBe(3);
  });

  it('detects extra node types in target', () => {
    const profile = makeVector({ a: 5 }, []);
    const target = makeVector({ a: 5, c: 2 }, []);
    const delta = computeDelta(profile, target);
    expect(delta.extraInTarget.length).toBe(1);
    expect(delta.extraInTarget[0]?.nodeType).toBe('c');
  });

  it('detects missing signatures', () => {
    const profile = makeVector({}, ['s1', 's2']);
    const target = makeVector({}, ['s2']);
    const delta = computeDelta(profile, target);
    expect(delta.missingSignatures).toEqual(['s1']);
  });

  it('detects extra signatures', () => {
    const profile = makeVector({}, ['s1']);
    const target = makeVector({}, ['s1', 's3']);
    const delta = computeDelta(profile, target);
    expect(delta.extraSignatures).toEqual(['s3']);
  });
});

describe('formatDelta', () => {
  it('formats missing node types', () => {
    const delta = {
      missingFromTarget: [{ nodeType: 'try_statement', expectedCount: 5.0 }],
      extraInTarget: [],
      missingSignatures: [],
      extraSignatures: [],
    };
    const text = formatDelta(delta);
    expect(text).toContain('try_statement');
    expect(text).toContain('expected ~5.0');
  });

  it('formats empty delta', () => {
    const delta = {
      missingFromTarget: [],
      extraInTarget: [],
      missingSignatures: [],
      extraSignatures: [],
    };
    const text = formatDelta(delta);
    expect(text).toContain('No structural differences');
  });

  it('does not contain raw code', () => {
    const delta = {
      missingFromTarget: [{ nodeType: 'catch_clause', expectedCount: 3.0 }],
      extraInTarget: [{ nodeType: 'arrow_function', actualCount: 2.0 }],
      missingSignatures: ['abc123'],
      extraSignatures: ['def456'],
    };
    const text = formatDelta(delta);
    // Should only contain node type names, numbers, and hash references
    expect(text).not.toMatch(/function\s+\w+\s*\(/);
    expect(text).not.toMatch(/import\s+/);
    expect(text).not.toMatch(/const\s+/);
  });
});
