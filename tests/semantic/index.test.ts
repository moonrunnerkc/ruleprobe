/**
 * Integration tests for the semantic analysis pipeline.
 *
 * Tests the direct-call flow: extraction -> engine -> integration.
 * No HTTP server needed; the engine runs locally.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  analyzeProjectSemantic,
  integrateSemanticResults,
} from '../../src/semantic/index.js';
import type { SemanticAnalysisConfig } from '../../src/semantic/types.js';
import type { ProjectAnalysis, ReportSummary } from '../../src/types.js';

const FIXTURE_DIR = resolve(__dirname, 'fixtures/sample-project');

function makeConfig(): SemanticAnalysisConfig {
  return {
    anthropicApiKey: 'test-key-not-used',
    maxLlmCalls: 0,
    useCache: false,
    fastPathThreshold: 0.85,
  };
}

function makeMinimalAnalysis(): ProjectAnalysis {
  const summary: ReportSummary = {
    totalRules: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    warnings: 0,
    adherenceScore: 100,
    byCategory: {} as ProjectAnalysis['summary']['byCategory'],
  };
  return {
    projectDir: FIXTURE_DIR,
    files: [],
    conflicts: [],
    redundancies: [],
    coverageMap: {},
    summary,
  };
}

describe('analyzeProjectSemantic', () => {
  it('performs full pipeline with zero LLM calls (fast-path only)', async () => {
    const result = await analyzeProjectSemantic(
      FIXTURE_DIR,
      makeConfig(),
      [
        {
          id: 'test-rule-1',
          category: 'code-style',
          source: 'Use functional components',
          description: 'Prefer functional components',
          severity: 'warning',
          verifier: 'ast',
          pattern: { type: 'prefer', target: '**/*.ts', expected: true, scope: 'file' },
          qualifier: 'prefer',
        },
      ],
    );

    expect(result.performed).toBe(true);
    expect(result.verdicts).toBeDefined();
    expect(result.sentPayload).toBeDefined();
    expect(result.report).toBeDefined();
  });

  it('enriches payload with extracted rules', async () => {
    const result = await analyzeProjectSemantic(
      FIXTURE_DIR,
      makeConfig(),
      [
        {
          id: 'naming-camelcase',
          category: 'naming',
          source: 'Use camelCase for variables',
          description: 'Variables should be camelCase',
          severity: 'error',
          verifier: 'ast',
          pattern: { type: 'camelCase', target: 'variables', expected: true, scope: 'file' },
          confidence: 'high',
          section: 'Naming',
          qualifier: 'always',
        },
      ],
    );

    expect(result.sentPayload).toBeDefined();
    expect(result.sentPayload!.rules.length).toBe(1);
    expect(result.sentPayload!.rules[0]!.ruleId).toBe('naming-camelcase');
    expect(result.sentPayload!.rules[0]!.qualifier).toBe('always');
    expect(result.sentPayload!.rules[0]!.confidence).toBe(1.0);
  });

  it('returns a report with verdicts for each rule', async () => {
    const result = await analyzeProjectSemantic(
      FIXTURE_DIR,
      makeConfig(),
      [
        {
          id: 'rule-a',
          category: 'error-handling',
          source: 'Use try/catch for error handling',
          description: 'Wrap error-prone code in try/catch',
          severity: 'warning',
          verifier: 'ast',
          pattern: { type: 'try-catch', target: '**/*.ts', expected: true, scope: 'file' },
          qualifier: 'prefer',
        },
        {
          id: 'rule-b',
          category: 'naming',
          source: 'Use camelCase',
          description: 'Variables should be camelCase',
          severity: 'error',
          verifier: 'ast',
          pattern: { type: 'camelCase', target: 'variables', expected: true, scope: 'file' },
          qualifier: 'always',
        },
      ],
    );

    expect(result.performed).toBe(true);
    expect(result.report).toBeDefined();
    expect(result.report!.verdicts.length).toBe(2);
    const totalRules = result.report!.rulesAnalyzed + result.report!.unresolvedRules;
    expect(totalRules).toBe(2);
  });
});

describe('integrateSemanticResults', () => {
  it('attaches semantic results to project analysis', () => {
    const analysis = makeMinimalAnalysis();
    const pipelineResult = {
      performed: true,
      verdicts: [
        {
          ruleId: 'r1',
          compliance: 0.9,
          method: 'structural-fast-path' as const,
          violations: [],
          mitigations: [],
          profileHash: 'abc',
          tokenCost: 0,
        },
      ],
    };

    const result = integrateSemanticResults(analysis, pipelineResult);
    const extended = result as ProjectAnalysis & {
      semantic?: { performed: boolean; verdicts: unknown[] };
    };

    expect(extended.semantic).toBeDefined();
    expect(extended.semantic!.performed).toBe(true);
    expect(extended.semantic!.verdicts.length).toBe(1);
  });

  it('attaches skip reason when semantic analysis was not performed', () => {
    const analysis = makeMinimalAnalysis();
    const pipelineResult = {
      performed: false,
      skipReason: 'No API key provided',
      verdicts: [],
    };

    const result = integrateSemanticResults(analysis, pipelineResult);
    const extended = result as ProjectAnalysis & {
      semantic?: { performed: boolean; skipReason?: string };
    };

    expect(extended.semantic!.performed).toBe(false);
    expect(extended.semantic!.skipReason).toBe('No API key provided');
  });
});
