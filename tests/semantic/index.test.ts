/**
 * Integration tests for the semantic analysis pipeline.
 *
 * Uses a local mock HTTP server (acceptable: external API boundary)
 * to test the full orchestration: extraction -> validation -> analysis -> integration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import {
  analyzeProjectSemantic,
  integrateSemanticResults,
} from '../../src/semantic/index.js';
import type { SemanticAnalysisConfig } from '../../src/semantic/types.js';
import type { ProjectAnalysis, ReportSummary } from '../../src/types.js';

const FIXTURE_DIR = resolve(__dirname, 'fixtures/sample-project');

let server: Server;
let port: number;
let validateResponse = { valid: true, tier: 'pro', callsRemaining: 100 };
let analyzeResponse = {
  report: {
    rulesAnalyzed: 1,
    fastPathResolutions: 1,
    llmResolutions: 0,
    unresolvedRules: 0,
    totalTokenCost: 0,
    verdicts: [
      {
        ruleId: 'test-rule-1',
        compliance: 0.92,
        method: 'structural-fast-path',
        violations: [],
        mitigations: [],
        profileHash: 'abc123',
        tokenCost: 0,
      },
    ],
    profile: {
      profileId: 'test',
      generatedAt: '2026-01-01T00:00:00Z',
      featureVectors: {},
      crossFileGraph: { edges: {} },
      sampleSize: 3,
    },
    profileCacheHit: false,
    fastPathThreshold: 0.85,
    crossFileFindings: [],
  },
};

function makeConfig(): SemanticAnalysisConfig {
  return {
    apiEndpoint: `http://127.0.0.1:${port}`,
    licenseKey: 'test-key-123',
    maxLlmCalls: 10,
    useCache: true,
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

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const url = req.url ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });

      if (url.includes('/v1/validate')) {
        res.end(JSON.stringify(validateResponse));
      } else if (url.includes('/v1/analyze')) {
        res.end(JSON.stringify(analyzeResponse));
      } else {
        res.end('{}');
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr !== null && typeof addr === 'object') {
        port = addr.port;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe('analyzeProjectSemantic', () => {
  it('performs full pipeline with valid license', async () => {
    validateResponse = { valid: true, tier: 'pro', callsRemaining: 100 };
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
    expect(result.verdicts.length).toBeGreaterThan(0);
    expect(result.sentPayload).toBeDefined();
  });

  it('skips when license is invalid', async () => {
    validateResponse = { valid: false, tier: 'none', callsRemaining: 0 };
    const result = await analyzeProjectSemantic(FIXTURE_DIR, makeConfig(), []);

    expect(result.performed).toBe(false);
    expect(result.skipReason).toContain('invalid or expired');
  });

  it('skips when no calls remaining', async () => {
    validateResponse = { valid: true, tier: 'pro', callsRemaining: 0 };
    const result = await analyzeProjectSemantic(FIXTURE_DIR, makeConfig(), []);

    expect(result.performed).toBe(false);
    expect(result.skipReason).toContain('No API calls remaining');
  });

  it('skips gracefully when API is unreachable', async () => {
    const config = {
      ...makeConfig(),
      apiEndpoint: 'http://127.0.0.1:1',
    };
    const result = await analyzeProjectSemantic(FIXTURE_DIR, config, []);

    expect(result.performed).toBe(false);
    expect(result.skipReason).toContain('Could not validate');
  });

  it('enriches payload with extracted rules', async () => {
    validateResponse = { valid: true, tier: 'pro', callsRemaining: 100 };
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
      skipReason: 'License invalid',
      verdicts: [],
    };

    const result = integrateSemanticResults(analysis, pipelineResult);
    const extended = result as ProjectAnalysis & {
      semantic?: { performed: boolean; skipReason?: string };
    };

    expect(extended.semantic!.performed).toBe(false);
    expect(extended.semantic!.skipReason).toBe('License invalid');
  });
});
