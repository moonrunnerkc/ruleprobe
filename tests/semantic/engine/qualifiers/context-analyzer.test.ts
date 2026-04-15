import { describe, it, expect } from 'vitest';
import { analyzeContext, countTrueFlags } from '../../../../src/semantic/engine/qualifiers/context-analyzer.js';
import type { RawFileVector } from '../../../../src/semantic/types.js';

function emptyVector(): RawFileVector {
  return { nodeTypeCounts: {}, nestingDepths: {}, subTreeHashes: [] };
}

describe('analyzeContext', () => {
  it('returns all false for empty vector', () => {
    const ctx = analyzeContext(emptyVector(), 5, 10);
    expect(ctx.inTightLoop).toBe(false);
    expect(ctx.thirdPartyBoundary).toBe(false);
    expect(ctx.deviationCommentPresent).toBe(false);
    expect(ctx.frameworkConstraintDetected).toBe(false);
    expect(ctx.legacyCodeRegion).toBe(false);
    expect(ctx.testCode).toBe(false);
    expect(ctx.variableReassigned).toBe(false);
  });

  it('detects tight loop when loop nesting depth exceeds threshold', () => {
    const v = emptyVector();
    v.nestingDepths['for_statement'] = 3;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.inTightLoop).toBe(true);
  });

  it('does not flag tight loop at threshold exactly', () => {
    const v = emptyVector();
    v.nestingDepths['for_statement'] = 2;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.inTightLoop).toBe(false);
  });

  it('detects tight loop for while_statement', () => {
    const v = emptyVector();
    v.nestingDepths['while_statement'] = 4;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.inTightLoop).toBe(true);
  });

  it('detects third-party boundary with sufficient call expressions', () => {
    const v = emptyVector();
    v.nodeTypeCounts['call_expression'] = 5;
    v.nodeTypeCounts['member_expression'] = 5;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.thirdPartyBoundary).toBe(true);
  });

  it('does not flag third-party below threshold', () => {
    const v = emptyVector();
    v.nodeTypeCounts['call_expression'] = 3;
    v.nodeTypeCounts['member_expression'] = 3;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.thirdPartyBoundary).toBe(false);
  });

  it('detects deviation comment flag', () => {
    const v = emptyVector();
    v.nodeTypeCounts['__flag:deviationComment'] = 1;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.deviationCommentPresent).toBe(true);
  });

  it('detects framework constraint with sufficient JSX elements', () => {
    const v = emptyVector();
    v.nodeTypeCounts['jsx_element'] = 3;
    v.nodeTypeCounts['export_statement'] = 3;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.frameworkConstraintDetected).toBe(true);
  });

  it('does not flag framework below threshold', () => {
    const v = emptyVector();
    v.nodeTypeCounts['jsx_element'] = 2;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.frameworkConstraintDetected).toBe(false);
  });

  it('detects legacy code region for files in oldest 20%', () => {
    const ctx = analyzeContext(emptyVector(), 1, 10);
    expect(ctx.legacyCodeRegion).toBe(true);
  });

  it('does not flag legacy at 20% boundary', () => {
    const ctx = analyzeContext(emptyVector(), 2, 10);
    expect(ctx.legacyCodeRegion).toBe(false);
  });

  it('handles zero total files for legacy check', () => {
    const ctx = analyzeContext(emptyVector(), 0, 0);
    expect(ctx.legacyCodeRegion).toBe(false);
  });

  it('detects test code flag', () => {
    const v = emptyVector();
    v.nodeTypeCounts['__flag:testCode'] = 1;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.testCode).toBe(true);
  });

  it('detects variable reassignment with assignment_expression', () => {
    const v = emptyVector();
    v.nodeTypeCounts['assignment_expression'] = 1;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.variableReassigned).toBe(true);
  });

  it('detects variable reassignment with update_expression', () => {
    const v = emptyVector();
    v.nodeTypeCounts['update_expression'] = 2;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.variableReassigned).toBe(true);
  });

  it('detects variable reassignment with augmented_assignment_expression', () => {
    const v = emptyVector();
    v.nodeTypeCounts['augmented_assignment_expression'] = 1;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.variableReassigned).toBe(true);
  });

  it('does not flag variable reassignment when counts are zero', () => {
    const v = emptyVector();
    v.nodeTypeCounts['assignment_expression'] = 0;
    v.nodeTypeCounts['update_expression'] = 0;
    const ctx = analyzeContext(v, 5, 10);
    expect(ctx.variableReassigned).toBe(false);
  });
});

describe('countTrueFlags', () => {
  it('returns 0 for all-false context', () => {
    const ctx = {
      inTightLoop: false,
      thirdPartyBoundary: false,
      deviationCommentPresent: false,
      frameworkConstraintDetected: false,
      legacyCodeRegion: false,
      testCode: false,
      variableReassigned: false,
    };
    expect(countTrueFlags(ctx)).toBe(0);
  });

  it('counts single true flag', () => {
    const ctx = {
      inTightLoop: true,
      thirdPartyBoundary: false,
      deviationCommentPresent: false,
      frameworkConstraintDetected: false,
      legacyCodeRegion: false,
      testCode: false,
      variableReassigned: false,
    };
    expect(countTrueFlags(ctx)).toBe(1);
  });

  it('counts multiple true flags', () => {
    const ctx = {
      inTightLoop: true,
      thirdPartyBoundary: true,
      deviationCommentPresent: true,
      frameworkConstraintDetected: false,
      legacyCodeRegion: false,
      testCode: false,
      variableReassigned: false,
    };
    expect(countTrueFlags(ctx)).toBe(3);
  });

  it('counts all true flags', () => {
    const ctx = {
      inTightLoop: true,
      thirdPartyBoundary: true,
      deviationCommentPresent: true,
      frameworkConstraintDetected: true,
      legacyCodeRegion: true,
      testCode: true,
      variableReassigned: true,
    };
    expect(countTrueFlags(ctx)).toBe(7);
  });

  it('counts variableReassigned as a true flag', () => {
    const ctx = {
      inTightLoop: false,
      thirdPartyBoundary: false,
      deviationCommentPresent: false,
      frameworkConstraintDetected: false,
      legacyCodeRegion: false,
      testCode: false,
      variableReassigned: true,
    };
    expect(countTrueFlags(ctx)).toBe(1);
  });
});
