/**
 * Tests verifying that not-verifiable verdicts are displayed
 * correctly in semantic analysis formatters and excluded from
 * aggregated compliance scores.
 */

import { describe, it, expect } from 'vitest';
import { formatSemanticSummary, formatCostReport } from '../../src/commands/analyze-formatters.js';
import type { SemanticAnalysisReport, SemanticVerdict } from '../../src/semantic/types.js';
import type { SemanticPipelineResult } from '../../src/semantic/index.js';

function makeFastPathVerdict(ruleId: string): SemanticVerdict {
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

function makeNotVerifiableVerdict(ruleId: string): SemanticVerdict {
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

function makeReport(overrides?: Partial<SemanticAnalysisReport>): SemanticAnalysisReport {
  return {
    rulesAnalyzed: 1,
    fastPathResolutions: 1,
    llmResolutions: 0,
    unresolvedRules: 0,
    totalTokenCost: 0,
    verdicts: [makeFastPathVerdict('r1')],
    profile: {
      profileId: 'test',
      generatedAt: '2026-01-01T00:00:00Z',
      featureVectors: new Map(),
      crossFileGraph: { edges: new Map() },
      sampleSize: 10,
    },
    profileCacheHit: false,
    fastPathThreshold: 0.85,
    crossFileFindings: [],
    ...overrides,
  };
}

describe('not-verifiable verdicts in formatters', () => {
  it('formatSemanticSummary shows not-verifiable count when present', () => {
    const result: SemanticPipelineResult = {
      performed: true,
      verdicts: [makeFastPathVerdict('r1'), makeNotVerifiableVerdict('r2')],
      report: makeReport({
        rulesAnalyzed: 1,
        unresolvedRules: 1,
        verdicts: [makeFastPathVerdict('r1'), makeNotVerifiableVerdict('r2')],
      }),
    };
    const output = formatSemanticSummary(result);
    expect(output).toContain('Not verifiable: 1');
  });

  it('formatSemanticSummary omits not-verifiable line when zero', () => {
    const result: SemanticPipelineResult = {
      performed: true,
      verdicts: [makeFastPathVerdict('r1')],
      report: makeReport(),
    };
    const output = formatSemanticSummary(result);
    expect(output).not.toContain('Not verifiable');
  });

  it('formatCostReport always shows not-verifiable count', () => {
    const report = makeReport({
      unresolvedRules: 3,
      rulesAnalyzed: 5,
    });
    const output = formatCostReport(report);
    expect(output).toContain('Not verifiable: 3');
    expect(output).toContain('Rules analyzed: 5');
  });

  it('formatCostReport shows zero not-verifiable', () => {
    const report = makeReport({ unresolvedRules: 0 });
    const output = formatCostReport(report);
    expect(output).toContain('Not verifiable: 0');
  });
});
