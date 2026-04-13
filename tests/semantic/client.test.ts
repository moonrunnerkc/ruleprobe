/**
 * Tests for the semantic API client.
 *
 * Uses a local HTTP server (acceptable mock: external API boundary)
 * to verify request handling, retry logic, graceful degradation,
 * and the critical privacy guarantee.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { validateLicense, analyzeRemote } from '../../src/semantic/client.js';
import type { SemanticAnalysisConfig, RawExtractionPayload } from '../../src/semantic/types.js';

let server: Server;
let port: number;
let lastRequestBody: string = '';
let responseOverride: {
  status?: number;
  body?: string;
  failCount?: number;
} = {};
let requestCount = 0;

function makeConfig(): SemanticAnalysisConfig {
  return {
    apiEndpoint: `http://127.0.0.1:${port}`,
    licenseKey: 'test-key-123',
    maxLlmCalls: 10,
    useCache: true,
    fastPathThreshold: 0.85,
  };
}

function makeSamplePayload(): RawExtractionPayload {
  return {
    fileVectors: {
      '0': {
        nodeTypeCounts: { function_declaration: 5, if_statement: 3 },
        nestingDepths: { if_statement: 2.5 },
        subTreeHashes: ['abc123', 'def456'],
      },
      '1': {
        nodeTypeCounts: { class_declaration: 1, method_definition: 4 },
        nestingDepths: { method_definition: 1.2 },
        subTreeHashes: ['ghi789'],
      },
    },
    rules: [
      {
        ruleId: 'test-rule-1',
        ruleText: 'Use functional components',
        qualifier: 'prefer',
        confidence: 0.9,
      },
    ],
    extractionHash: 'abc123def456',
  };
}

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    requestCount++;
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      lastRequestBody = body;

      if (responseOverride.failCount !== undefined && responseOverride.failCount > 0) {
        responseOverride.failCount--;
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }

      const status = responseOverride.status ?? 200;
      const responseBody = responseOverride.body ?? '{}';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(responseBody);
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

describe('validateLicense', () => {
  it('returns validation response on success', async () => {
    responseOverride = {
      body: JSON.stringify({ valid: true, tier: 'pro', callsRemaining: 100 }),
    };
    const result = await validateLicense(makeConfig());
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(result!.tier).toBe('pro');
    expect(result!.callsRemaining).toBe(100);
  });

  it('returns null on HTTP error', async () => {
    responseOverride = { status: 403, body: '{"error": "forbidden"}' };
    const result = await validateLicense(makeConfig());
    expect(result).toBeNull();
  });

  it('returns null when API is unreachable', async () => {
    const config = {
      ...makeConfig(),
      apiEndpoint: 'http://127.0.0.1:1',
    };
    const result = await validateLicense(config);
    expect(result).toBeNull();
  });
});

describe('analyzeRemote', () => {
  it('sends payload and returns analysis response', async () => {
    const mockReport = {
      verdicts: [{ ruleId: 'r1', compliance: 0.9 }],
      report: { rulesAnalyzed: 1 },
    };
    responseOverride = { body: JSON.stringify(mockReport) };
    const result = await analyzeRemote(makeConfig(), makeSamplePayload());
    expect(result).not.toBeNull();
  });

  it('returns null on persistent failure', async () => {
    responseOverride = { status: 500, body: 'Internal Server Error' };
    const result = await analyzeRemote(makeConfig(), makeSamplePayload());
    expect(result).toBeNull();
  });

  it('retries once on transient 500 then succeeds', async () => {
    responseOverride = {
      failCount: 1,
      body: JSON.stringify({ verdicts: [], report: {} }),
    };
    requestCount = 0;
    const result = await analyzeRemote(makeConfig(), makeSamplePayload());
    expect(result).not.toBeNull();
    expect(requestCount).toBe(2);
  });

  it('returns null when API is unreachable', async () => {
    const config = {
      ...makeConfig(),
      apiEndpoint: 'http://127.0.0.1:1',
    };
    const result = await analyzeRemote(config, makeSamplePayload());
    expect(result).toBeNull();
  });
});

describe('privacy: no raw code in request payloads', () => {
  it('request payload contains only numeric vectors, hashes, and rule text', async () => {
    responseOverride = {
      body: JSON.stringify({ verdicts: [], report: {} }),
    };

    await analyzeRemote(makeConfig(), makeSamplePayload());

    const body = lastRequestBody;
    expect(body.length).toBeGreaterThan(0);

    const parsed = JSON.parse(body) as Record<string, unknown>;
    const serialized = JSON.stringify(parsed);

    // No file paths
    expect(serialized).not.toMatch(/\.(ts|js|tsx|jsx|mjs|cjs)\b/);
    expect(serialized).not.toContain('/src/');
    expect(serialized).not.toContain('/tests/');
    expect(serialized).not.toContain('\\src\\');

    // No code identifiers
    expect(serialized).not.toContain('const ');
    expect(serialized).not.toContain('let ');
    expect(serialized).not.toContain('var ');
    expect(serialized).not.toContain('import ');
    expect(serialized).not.toContain('export ');
    expect(serialized).not.toContain('require(');

    // No comments
    expect(serialized).not.toContain('//');
    expect(serialized).not.toContain('/*');

    // File vectors use opaque integer keys only
    const payload = (parsed as Record<string, Record<string, unknown>>)['payload'];
    const fileVectors = (payload as Record<string, Record<string, unknown>>)['fileVectors'];
    if (fileVectors !== undefined) {
      for (const key of Object.keys(fileVectors as Record<string, unknown>)) {
        expect(key).toMatch(/^\d+$/);
      }
    }
  });
});
