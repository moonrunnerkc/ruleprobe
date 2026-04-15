/**
 * Tests for vector similarity scoring.
 *
 * Hand-calculable expected values for Jaccard, cosine, and combined.
 */

import { describe, it, expect } from 'vitest';
import {
  weightedJaccard,
  cosineSimilarity,
  combinedSimilarity,
  JACCARD_WEIGHT,
  COSINE_WEIGHT,
  COMPOSITE_JACCARD_WEIGHT,
} from '../../../../src/semantic/engine/comparison/vector-similarity.js';
import type { FeatureVector } from '../../../../src/semantic/types.js';

describe('weightedJaccard', () => {
  it('returns 1.0 for identical counts', () => {
    const counts = { a: 5, b: 10 };
    expect(weightedJaccard(counts, counts)).toBe(1.0);
  });

  it('returns 0.0 for completely disjoint counts', () => {
    const a = { x: 5 };
    const b = { y: 10 };
    // intersection = 0, union = max(5,0) + max(0,10) = 15
    expect(weightedJaccard(a, b)).toBe(0.0);
  });

  it('handles partially overlapping counts', () => {
    const a = { x: 4, y: 6 };
    const b = { x: 2, z: 3 };
    // keys: x, y, z
    // x: min(4,2)=2, max(4,2)=4
    // y: min(6,0)=0, max(6,0)=6
    // z: min(0,3)=0, max(0,3)=3
    // intersection=2, union=13
    expect(weightedJaccard(a, b)).toBeCloseTo(2 / 13, 10);
  });

  it('returns 1.0 for two empty count objects', () => {
    expect(weightedJaccard({}, {})).toBe(1.0);
  });

  it('returns 0.0 when one side has counts and other is empty', () => {
    expect(weightedJaccard({ a: 5 }, {})).toBe(0.0);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical signatures', () => {
    const sigs = ['s1', 's2', 's3'];
    expect(cosineSimilarity(sigs, sigs)).toBeCloseTo(1.0, 10);
  });

  it('returns 0.0 for completely disjoint signatures', () => {
    expect(cosineSimilarity(['a', 'b'], ['c', 'd'])).toBe(0.0);
  });

  it('handles partial overlap', () => {
    const a = ['s1', 's2'];
    const b = ['s2', 's3'];
    // dot=1, |a|=sqrt(2), |b|=sqrt(2)
    // cosine = 1 / (sqrt(2)*sqrt(2)) = 1/2 = 0.5
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.5, 10);
  });

  it('returns 1.0 for two empty signature arrays', () => {
    expect(cosineSimilarity([], [])).toBe(1.0);
  });

  it('returns 0.0 when one side is empty', () => {
    expect(cosineSimilarity(['a'], [])).toBe(0.0);
    expect(cosineSimilarity([], ['a'])).toBe(0.0);
  });

  it('handles duplicate signatures (set semantics)', () => {
    // Duplicates in input should not inflate the score
    const a = ['s1', 's1', 's2'];
    const b = ['s1'];
    // profileSet={s1,s2}, targetSet={s1}
    // dot=1, |a|=sqrt(2), |b|=sqrt(1)=1
    // cosine = 1/(sqrt(2)*1) = 1/sqrt(2)
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2), 10);
  });
});

describe('combinedSimilarity', () => {
  it('weights are 0.25 (node Jaccard), 0.35 (composite Jaccard), 0.4 (cosine)', () => {
    expect(JACCARD_WEIGHT).toBe(0.25);
    expect(COMPOSITE_JACCARD_WEIGHT).toBe(0.35);
    expect(COSINE_WEIGHT).toBe(0.4);
  });

  it('returns 1.0 for identical vectors', () => {
    const v: FeatureVector = {
      nodeTypeCounts: { a: 5 },
      nestingDepths: {},
      patternSignatures: ['s1'],
      prevalence: 0.5,
      compositePatterns: {},
    };
    expect(combinedSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('returns 0.0 for completely disjoint vectors', () => {
    const a: FeatureVector = {
      nodeTypeCounts: { x: 5 },
      nestingDepths: {},
      patternSignatures: ['a'],
      prevalence: 0.5,
      compositePatterns: { 'p1': 1 },
    };
    const b: FeatureVector = {
      nodeTypeCounts: { y: 5 },
      nestingDepths: {},
      patternSignatures: ['b'],
      prevalence: 0.5,
      compositePatterns: { 'p2': 1 },
    };
    expect(combinedSimilarity(a, b)).toBe(0.0);
  });

  it('computes correct combined value for known inputs', () => {
    const profile: FeatureVector = {
      nodeTypeCounts: { a: 4, b: 6 },
      nestingDepths: {},
      patternSignatures: ['s1', 's2'],
      prevalence: 0.5,
      compositePatterns: { 'c1': 1.0 },
    };
    const target: FeatureVector = {
      nodeTypeCounts: { a: 2, c: 3 },
      nestingDepths: {},
      patternSignatures: ['s2', 's3'],
      prevalence: 0.5,
      compositePatterns: { 'c1': 0.5, 'c2': 0.5 },
    };

    // Node Jaccard: keys a,b,c
    // a: min(4,2)=2, max(4,2)=4
    // b: min(6,0)=0, max(6,0)=6
    // c: min(0,3)=0, max(0,3)=3
    // intersection=2, union=13, jaccard=2/13
    const expectedNodeJaccard = 2 / 13;

    // Composite Jaccard: keys c1,c2
    // c1: min(1.0,0.5)=0.5, max(1.0,0.5)=1.0
    // c2: min(0,0.5)=0, max(0,0.5)=0.5
    // intersection=0.5, union=1.5, jaccard=0.5/1.5=1/3
    const expectedCompositeJaccard = 1 / 3;

    // Cosine: profile={s1,s2}, target={s2,s3}
    // dot=1, |a|=sqrt(2), |b|=sqrt(2)
    // cosine = 1/2
    const expectedCosine = 0.5;

    const expected = 0.25 * expectedNodeJaccard + 0.35 * expectedCompositeJaccard + 0.4 * expectedCosine;
    expect(combinedSimilarity(profile, target)).toBeCloseTo(expected, 10);
  });

  it('accepts custom weights', () => {
    const v: FeatureVector = {
      nodeTypeCounts: { a: 5 },
      nestingDepths: {},
      patternSignatures: [],
      prevalence: 0.5,
      compositePatterns: {},
    };
    // Both empty sigs => cosine=1.0
    // Same counts => jaccard=1.0
    // Both empty composites => composite jaccard=1.0
    // Custom weights 0.5 + 0.2 + 0.3 = 1.0
    expect(combinedSimilarity(v, v, 0.5, 0.3, 0.2)).toBeCloseTo(1.0, 10);
  });

  it('composites contribute to combined score when present', () => {
    const base: FeatureVector = {
      nodeTypeCounts: { a: 5 },
      nestingDepths: {},
      patternSignatures: ['s1'],
      prevalence: 0.5,
      compositePatterns: {},
    };
    const withComposites: FeatureVector = {
      ...base,
      compositePatterns: { 'try-catch-with-logging': 0.8 },
    };
    // Identical base vectors but different composites
    // compositeJaccard between {} and {try-catch-with-logging:0.8} = 0
    const scoreWithout = combinedSimilarity(base, base);
    const scoreWith = combinedSimilarity(base, withComposites);
    expect(scoreWith).toBeLessThan(scoreWithout);
  });
});
