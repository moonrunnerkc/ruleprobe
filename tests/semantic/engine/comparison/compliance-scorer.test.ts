/**
 * Tests for compliance score assembly.
 */

import { describe, it, expect } from 'vitest';
import type { SemanticVerdict, StructuralProfile } from '../../../../src/semantic/types.js';
import { assembleReport } from '../../../../src/semantic/engine/comparison/compliance-scorer.js';

function makeProfile(): StructuralProfile {
  return {
    profileId: 'test',
    generatedAt: '2026-01-01T00:00:00Z',
    featureVectors: new Map(),
    crossFileGraph: { edges: new Map() },
    sampleSize: 10,
  };
}

function fastPathVerdict(ruleId: string): SemanticVerdict {
  return {
    ruleId,
    compliance: 0.9,
    method: 'structural-fast-path',
    violations: [],
    mitigations: [],
    profileHash: 'hash',
    tokenCost: 0,
  };
}

function llmVerdict(ruleId: string, tokens: number): SemanticVerdict {
  return {
    ruleId,
    compliance: 0.7,
    method: 'llm-assisted',
    reasoning: 'test',
    violations: [],
    mitigations: [],
    profileHash: 'hash',
    tokenCost: tokens,
  };
}

function notVerifiableVerdict(ruleId: string): SemanticVerdict {
  return {
    ruleId,
    compliance: -1,
    method: 'not-verifiable',
    reasoning: 'No matching topic in structural profile; rule cannot be verified semantically',
    violations: [],
    mitigations: [],
    profileHash: 'hash',
    tokenCost: 0,
  };
}

describe('assembleReport', () => {
  it('counts fast-path and LLM resolutions', () => {
    const verdicts = [
      fastPathVerdict('r1'),
      fastPathVerdict('r2'),
      llmVerdict('r3', 100),
    ];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.fastPathResolutions).toBe(2);
    expect(report.llmResolutions).toBe(1);
  });

  it('sums total token cost', () => {
    const verdicts = [llmVerdict('r1', 50), llmVerdict('r2', 75)];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.totalTokenCost).toBe(125);
  });

  it('includes profile and cache hit status', () => {
    const report = assembleReport([], makeProfile(), true, 0.9, []);
    expect(report.profileCacheHit).toBe(true);
    expect(report.fastPathThreshold).toBe(0.9);
  });

  it('sets rulesAnalyzed from verdict count', () => {
    const verdicts = [fastPathVerdict('r1'), fastPathVerdict('r2')];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.rulesAnalyzed).toBe(2);
  });

  it('includes cross-file findings', () => {
    const findings = [{
      topic: 'error-handling',
      consistentFiles: ['0', '1'],
      deviatingFiles: ['2'],
      signatureHash: 'sigA',
    }];
    const report = assembleReport([], makeProfile(), false, 0.85, findings);
    expect(report.crossFileFindings.length).toBe(1);
  });

  it('counts not-verifiable verdicts as unresolvedRules', () => {
    const verdicts = [
      fastPathVerdict('r1'),
      notVerifiableVerdict('r2'),
      llmVerdict('r3', 100),
    ];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.unresolvedRules).toBe(1);
    expect(report.fastPathResolutions).toBe(1);
    expect(report.llmResolutions).toBe(1);
  });

  it('excludes not-verifiable verdicts from rulesAnalyzed count', () => {
    const verdicts = [
      fastPathVerdict('r1'),
      notVerifiableVerdict('r2'),
      notVerifiableVerdict('r3'),
    ];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.rulesAnalyzed).toBe(1);
    expect(report.unresolvedRules).toBe(2);
  });

  it('handles all-not-verifiable verdicts', () => {
    const verdicts = [
      notVerifiableVerdict('r1'),
      notVerifiableVerdict('r2'),
    ];
    const report = assembleReport(verdicts, makeProfile(), false, 0.85, []);
    expect(report.rulesAnalyzed).toBe(0);
    expect(report.unresolvedRules).toBe(2);
    expect(report.fastPathResolutions).toBe(0);
    expect(report.llmResolutions).toBe(0);
  });
});
