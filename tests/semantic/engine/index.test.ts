import { describe, it, expect, vi } from 'vitest';
import { analyzeSemantic } from '../../../src/semantic/engine/index.js';
import type { RawExtractionPayload, LlmCaller } from '../../../src/semantic/types.js';

function makePayload(overrides?: Partial<RawExtractionPayload>): RawExtractionPayload {
  return {
    fileVectors: {
      '0': {
        nodeTypeCounts: {
          'try_statement': 10,
          'catch_clause': 9,
          'throw_statement': 5,
          'call_expression': 20,
          'member_expression': 15,
          'function_declaration': 8,
        },
        nestingDepths: { 'try_statement': 2, 'if_statement': 3 },
        subTreeHashes: ['abc123', 'def456'],
      },
      '1': {
        nodeTypeCounts: {
          'try_statement': 8,
          'catch_clause': 7,
          'throw_statement': 4,
          'call_expression': 18,
          'member_expression': 12,
          'function_declaration': 6,
        },
        nestingDepths: { 'try_statement': 2, 'if_statement': 2 },
        subTreeHashes: ['abc123', 'ghi789'],
      },
      '2': {
        nodeTypeCounts: {
          'try_statement': 12,
          'catch_clause': 11,
          'throw_statement': 6,
          'call_expression': 22,
          'member_expression': 17,
          'function_declaration': 9,
        },
        nestingDepths: { 'try_statement': 3, 'if_statement': 2 },
        subTreeHashes: ['abc123', 'def456', 'jkl012'],
      },
    },
    rules: [
      {
        ruleId: 'rule-error-1',
        ruleText: 'Always use proper error handling with try/catch blocks',
        qualifier: 'always',
        confidence: 0.9,
      },
    ],
    extractionHash: 'test-hash-001',
    ...overrides,
  };
}

function stubLlmCaller(): LlmCaller {
  return vi.fn().mockResolvedValue(JSON.stringify({
    compliance: 0.7,
    reasoning: 'Mostly aligned with error handling patterns',
    violations: ['missing custom error types'],
    mitigations: ['standard try/catch present'],
  }));
}

describe('analyzeSemantic', () => {
  it('produces a SemanticAnalysisReport', async () => {
    const payload = makePayload();
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });

    expect(report.rulesAnalyzed).toBe(1);
    expect(report.verdicts).toHaveLength(1);
    expect(report.profile).toBeDefined();
    expect(report.profile.profileId).toBe('test-hash-001');
    expect(report.fastPathThreshold).toBe(0.85);
  });

  it('assigns compliance scores to verdicts', async () => {
    const payload = makePayload();
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });

    const verdict = report.verdicts[0];
    expect(verdict).toBeDefined();
    expect(verdict?.compliance).toBeGreaterThanOrEqual(0);
    expect(verdict?.compliance).toBeLessThanOrEqual(1);
    expect(verdict?.ruleId).toBe('rule-error-1');
  });

  it('handles multiple rules', async () => {
    const payload = makePayload({
      rules: [
        {
          ruleId: 'rule-1',
          ruleText: 'Use proper error handling',
          qualifier: 'always',
          confidence: 0.9,
        },
        {
          ruleId: 'rule-2',
          ruleText: 'Follow testing patterns with describe/it blocks',
          qualifier: 'prefer',
          confidence: 0.8,
        },
      ],
    });
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(report.rulesAnalyzed).toBe(2);
    expect(report.verdicts).toHaveLength(2);
  });

  it('respects maxLlmCalls limit', async () => {
    const llm = stubLlmCaller();
    const payload = makePayload();
    await analyzeSemantic(payload, llm, {
      useCache: false,
      maxLlmCalls: 0,
    });
    expect(llm).not.toHaveBeenCalled();
  });

  it('handles rules with no matching topic as not-verifiable', async () => {
    const payload = makePayload({
      rules: [
        {
          ruleId: 'rule-unknown',
          ruleText: 'Use quantum entanglement for data sync',
          qualifier: 'always',
          confidence: 0.5,
        },
      ],
    });
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(report.verdicts).toHaveLength(1);
    expect(report.verdicts[0]?.method).toBe('not-verifiable');
    expect(report.verdicts[0]?.compliance).toBe(-1);
    expect(report.unresolvedRules).toBe(1);
    expect(report.rulesAnalyzed).toBe(0);
  });

  it('handles when-possible qualified rules deterministically', async () => {
    const llm = stubLlmCaller();
    const payload = makePayload({
      rules: [
        {
          ruleId: 'rule-soft',
          ruleText: 'When possible, use error handling',
          qualifier: 'when-possible',
          confidence: 0.7,
        },
      ],
    });
    const report = await analyzeSemantic(payload, llm, { useCache: false });
    expect(report.verdicts).toHaveLength(1);
    const v = report.verdicts[0];
    expect(v).toBeDefined();
    expect(v?.compliance).toBeGreaterThanOrEqual(0);
  });

  it('tracks tokenCost in report', async () => {
    const payload = makePayload();
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(typeof report.totalTokenCost).toBe('number');
  });

  it('includes crossFileFindings', async () => {
    const payload = makePayload();
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(Array.isArray(report.crossFileFindings)).toBe(true);
  });

  it('reports profileCacheHit as false on first run', async () => {
    const payload = makePayload({ extractionHash: `unique-${Date.now()}` });
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(report.profileCacheHit).toBe(false);
  });

  it('uses custom fastPathThreshold', async () => {
    const payload = makePayload();
    const report = await analyzeSemantic(payload, stubLlmCaller(), {
      useCache: false,
      fastPathThreshold: 0.5,
    });
    expect(report.fastPathThreshold).toBe(0.5);
  });

  it('handles empty payload gracefully', async () => {
    const payload: RawExtractionPayload = {
      fileVectors: {},
      rules: [
        {
          ruleId: 'rule-1',
          ruleText: 'Use error handling',
          qualifier: 'always',
          confidence: 0.9,
        },
      ],
      extractionHash: 'empty-hash',
    };
    const report = await analyzeSemantic(payload, stubLlmCaller(), { useCache: false });
    expect(report.rulesAnalyzed).toBe(0);
    expect(report.unresolvedRules).toBe(1);
    expect(report.verdicts).toHaveLength(1);
    expect(report.verdicts[0]?.method).toBe('not-verifiable');
  });
});
