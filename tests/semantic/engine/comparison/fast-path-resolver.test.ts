/**
 * Tests for fast-path resolver.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureVector } from '../../../../src/semantic/types.js';
import {
  attemptFastPath,
  buildFastPathVerdict,
  PRE_CALIBRATION_THRESHOLD,
} from '../../../../src/semantic/engine/comparison/fast-path-resolver.js';

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

describe('attemptFastPath', () => {
  it('resolves when similarity meets threshold', () => {
    const v = makeVector({ a: 5 }, ['s1']);
    const result = attemptFastPath(v, v, 0.85);
    expect(result.resolved).toBe(true);
    expect(result.compliance).toBeCloseTo(1.0, 5);
  });

  it('does not resolve when similarity is below threshold', () => {
    const a = makeVector({ x: 10 }, ['s1']);
    const b = makeVector({ y: 10 }, ['s2']);
    const result = attemptFastPath(a, b, 0.85);
    expect(result.resolved).toBe(false);
  });

  it('returns the raw similarity score', () => {
    const v = makeVector({ a: 5 }, []);
    const result = attemptFastPath(v, v, 0.5);
    expect(result.similarity).toBeCloseTo(1.0, 5);
  });

  it('uses PRE_CALIBRATION_THRESHOLD as default', () => {
    expect(PRE_CALIBRATION_THRESHOLD).toBe(0.85);
  });

  it('resolves at exact threshold boundary', () => {
    // Use custom threshold that exactly matches the computed score
    const v = makeVector({ a: 5 }, ['x']);
    const similarity = 1.0; // identical vectors
    const result = attemptFastPath(v, v, similarity);
    expect(result.resolved).toBe(true);
  });
});

describe('buildFastPathVerdict', () => {
  it('creates a verdict with structural-fast-path method', () => {
    const verdict = buildFastPathVerdict('r1', 0.92, 'hash123');
    expect(verdict.method).toBe('structural-fast-path');
  });

  it('has zero token cost', () => {
    const verdict = buildFastPathVerdict('r1', 0.92, 'hash123');
    expect(verdict.tokenCost).toBe(0);
  });

  it('includes the correct rule id and compliance', () => {
    const verdict = buildFastPathVerdict('r42', 0.88, 'hash456');
    expect(verdict.ruleId).toBe('r42');
    expect(verdict.compliance).toBe(0.88);
    expect(verdict.profileHash).toBe('hash456');
  });

  it('has empty violations and mitigations', () => {
    const verdict = buildFastPathVerdict('r1', 0.9, 'h');
    expect(verdict.violations).toEqual([]);
    expect(verdict.mitigations).toEqual([]);
  });
});
