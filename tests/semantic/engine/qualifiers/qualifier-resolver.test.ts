import { describe, it, expect } from 'vitest';
import {
  resolveQualifier,
  applyLlmJudgment,
  buildQualifierVerdict,
} from '../../../../src/semantic/engine/qualifiers/qualifier-resolver.js';
import type { QualifierContext } from '../../../../src/semantic/types.js';

function allFalseCtx(): QualifierContext {
  return {
    inTightLoop: false,
    thirdPartyBoundary: false,
    deviationCommentPresent: false,
    frameworkConstraintDetected: false,
    legacyCodeRegion: false,
    testCode: false,
    variableReassigned: false,
  };
}

function oneFlagCtx(): QualifierContext {
  return { ...allFalseCtx(), inTightLoop: true };
}

function twoFlagCtx(): QualifierContext {
  return { ...allFalseCtx(), inTightLoop: true, testCode: true };
}

describe('resolveQualifier', () => {
  it('passes through always qualifier without resolution', () => {
    const res = resolveQualifier('always', allFalseCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBeNull();
    expect(res.needsLlm).toBe(false);
  });

  it('passes through never qualifier without resolution', () => {
    const res = resolveQualifier('never', allFalseCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBeNull();
    expect(res.needsLlm).toBe(false);
  });

  it('passes through prefer qualifier without resolution', () => {
    const res = resolveQualifier('prefer', allFalseCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBeNull();
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.7 for when-possible with 2+ flags', () => {
    const res = resolveQualifier('when-possible', twoFlagCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.7);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.6 for when-possible with 1 flag', () => {
    const res = resolveQualifier('when-possible', oneFlagCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.6);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.2 for when-possible with 0 flags', () => {
    const res = resolveQualifier('when-possible', allFalseCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.2);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.7 for try-to with 2+ flags', () => {
    const res = resolveQualifier('try-to', twoFlagCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.7);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.2 for try-to with 0 flags', () => {
    const res = resolveQualifier('try-to', allFalseCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.2);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.7 for avoid-unless with 2+ flags', () => {
    const res = resolveQualifier('avoid-unless', twoFlagCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.7);
    expect(res.needsLlm).toBe(false);
  });

  it('returns 0.6 for avoid-unless with 1 flag', () => {
    const res = resolveQualifier('avoid-unless', oneFlagCtx());
    expect(res.resolved).toBe(true);
    expect(res.compliance).toBe(0.6);
    expect(res.needsLlm).toBe(false);
  });

  it('escalates avoid-unless with 0 flags to LLM', () => {
    const res = resolveQualifier('avoid-unless', allFalseCtx());
    expect(res.resolved).toBe(false);
    expect(res.compliance).toBeNull();
    expect(res.needsLlm).toBe(true);
  });
});

describe('applyLlmJudgment', () => {
  it('returns 0.6 for justified with high confidence', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.9 })).toBe(0.6);
  });

  it('returns 0.4 for justified with moderate confidence', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.7 })).toBe(0.4);
  });

  it('returns 0.4 at the moderate threshold boundary (0.5)', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.5 })).toBe(0.4);
  });

  it('returns 0.1 for justified with low confidence', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.3 })).toBe(0.1);
  });

  it('returns 0.1 for not justified regardless of confidence', () => {
    expect(applyLlmJudgment({ justified: false, reason: 'no', confidence: 0.95 })).toBe(0.1);
  });

  it('returns 0.6 at exactly threshold 0.8 boundary (above, not >=)', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.8 })).toBe(0.4);
  });

  it('returns 0.6 just above 0.8', () => {
    expect(applyLlmJudgment({ justified: true, reason: 'ok', confidence: 0.81 })).toBe(0.6);
  });
});

describe('buildQualifierVerdict', () => {
  it('builds a well-formed verdict', () => {
    const verdict = buildQualifierVerdict(
      'rule-1',
      0.6,
      'structural-fast-path',
      '1 flag justified',
      'hash123',
      0,
      [],
      ['test code'],
    );
    expect(verdict.ruleId).toBe('rule-1');
    expect(verdict.compliance).toBe(0.6);
    expect(verdict.method).toBe('structural-fast-path');
    expect(verdict.reasoning).toBe('1 flag justified');
    expect(verdict.profileHash).toBe('hash123');
    expect(verdict.tokenCost).toBe(0);
    expect(verdict.violations).toEqual([]);
    expect(verdict.mitigations).toEqual(['test code']);
  });

  it('builds an LLM-assisted verdict', () => {
    const verdict = buildQualifierVerdict(
      'rule-2',
      0.4,
      'llm-assisted',
      'LLM confirmed',
      'hash456',
      150,
      [{ feature: 'error-handling', location: 'file:3', expected: 'try-catch', found: 'none' }],
      [],
    );
    expect(verdict.method).toBe('llm-assisted');
    expect(verdict.tokenCost).toBe(150);
    expect(verdict.violations).toHaveLength(1);
  });
});
