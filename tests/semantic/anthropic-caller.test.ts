/**
 * Tests for the Anthropic caller.
 *
 * Uses vi.stubGlobal to mock fetch (acceptable: external API boundary).
 */

import { describe, it, expect, vi } from 'vitest';
import { createAnthropicCaller } from '../../src/semantic/anthropic-caller.js';

describe('createAnthropicCaller', () => {
  it('creates a callable function', () => {
    const caller = createAnthropicCaller({ apiKey: 'test-key' });
    expect(typeof caller).toBe('function');
  });

  it('calls the Anthropic API with correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"compliance": 0.8}' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const caller = createAnthropicCaller({
      apiKey: 'test-api-key',
      apiUrl: 'https://mock.api/v1/messages',
    });

    await caller('claude-sonnet-4-6', 'Test prompt');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mock.api/v1/messages');
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('test-api-key');
    expect((options.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');

    vi.unstubAllGlobals();
  });

  it('sends the model and prompt in request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'response' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const caller = createAnthropicCaller({
      apiKey: 'key',
      apiUrl: 'https://mock.api/v1/messages',
    });
    await caller('claude-sonnet-4-6', 'My prompt');

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body['model']).toBe('claude-sonnet-4-6');
    expect((body['messages'] as Array<{ content: string }>)[0]?.content).toBe('My prompt');

    vi.unstubAllGlobals();
  });

  it('returns text from Anthropic response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"compliance": 0.9}' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const caller = createAnthropicCaller({
      apiKey: 'key',
      apiUrl: 'https://mock.api/v1/messages',
    });
    const result = await caller('claude-sonnet-4-6', 'prompt');
    expect(result).toBe('{"compliance": 0.9}');

    vi.unstubAllGlobals();
  });

  it('throws on non-OK response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });
    vi.stubGlobal('fetch', mockFetch);

    const caller = createAnthropicCaller({
      apiKey: 'key',
      apiUrl: 'https://mock.api/v1/messages',
    });

    await expect(caller('claude-sonnet-4-6', 'prompt')).rejects.toThrow(
      'Anthropic API returned 429',
    );

    vi.unstubAllGlobals();
  });

  it('returns empty string when no text content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const caller = createAnthropicCaller({
      apiKey: 'key',
      apiUrl: 'https://mock.api/v1/messages',
    });
    const result = await caller('claude-sonnet-4-6', 'prompt');
    expect(result).toBe('');

    vi.unstubAllGlobals();
  });
});
