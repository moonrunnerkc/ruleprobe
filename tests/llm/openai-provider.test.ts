/**
 * Tests for the OpenAI provider's retry behavior on transient errors.
 *
 * These tests inject a fake fetch implementation so we can drive the
 * retry path deterministically without touching the network.
 */

import { describe, it, expect } from 'vitest';
import { createOpenAiProvider } from '../../src/llm/openai-provider.js';

const PROMPT_PATTERNS = ['camelCase', 'no-any'];

/** Build a Response-like object with the given status, body, and headers. */
function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

/** Body that parses through the extractor without errors. */
const SUCCESS_BODY = {
  choices: [
    {
      message: {
        content: JSON.stringify({ rules: [], unparseable_lines: [] }),
      },
    },
  ],
};

describe('createOpenAiProvider retry behavior', () => {
  it('retries on 429 and succeeds on a follow-up 200', async () => {
    const calls: number[] = [];
    const fetchImpl = async (): Promise<Response> => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return makeResponse(429, '', { 'Retry-After': '0' });
      }
      return makeResponse(200, SUCCESS_BODY);
    };

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      maxAttempts: 3,
      sleep: async () => undefined,
      fetchImpl,
    });

    await provider.extractRules(['some unparseable line'], PROMPT_PATTERNS);
    expect(calls.length).toBe(2);
  });

  it('retries on 503 and succeeds on a follow-up 200', async () => {
    const responses: Response[] = [
      makeResponse(503, ''),
      makeResponse(200, SUCCESS_BODY),
    ];
    let i = 0;
    const fetchImpl = async (): Promise<Response> => {
      const next = responses[i] ?? makeResponse(500, 'unexpected');
      i += 1;
      return next;
    };

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      maxAttempts: 3,
      sleep: async () => undefined,
      fetchImpl,
    });

    await provider.extractRules(['line'], PROMPT_PATTERNS);
    expect(i).toBe(2);
  });

  it('does not retry on 400 (non-transient error)', async () => {
    let calls = 0;
    const fetchImpl = async (): Promise<Response> => {
      calls += 1;
      return makeResponse(400, 'bad request');
    };

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      maxAttempts: 3,
      sleep: async () => undefined,
      fetchImpl,
    });

    await expect(provider.extractRules(['line'], PROMPT_PATTERNS)).rejects.toThrow(
      /OpenAI API error 400/,
    );
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts when all attempts return 429', async () => {
    let calls = 0;
    const fetchImpl = async (): Promise<Response> => {
      calls += 1;
      return makeResponse(429, '', { 'Retry-After': '0' });
    };

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      maxAttempts: 2,
      sleep: async () => undefined,
      fetchImpl,
    });

    await expect(provider.extractRules(['line'], PROMPT_PATTERNS)).rejects.toThrow(
      /OpenAI API error 429/,
    );
    expect(calls).toBe(2);
  });

  it('honors the Retry-After header value when present', async () => {
    const sleeps: number[] = [];
    const responses: Response[] = [
      makeResponse(429, '', { 'Retry-After': '2' }),
      makeResponse(200, SUCCESS_BODY),
    ];
    let i = 0;
    const fetchImpl = async (): Promise<Response> => {
      const next = responses[i] ?? makeResponse(500, 'unexpected');
      i += 1;
      return next;
    };

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      maxAttempts: 3,
      retryBaseDelayMs: 9999,
      sleep: async (ms) => { sleeps.push(ms); },
      fetchImpl,
    });

    await provider.extractRules(['line'], PROMPT_PATTERNS);
    expect(sleeps).toEqual([2000]);
  });
});
