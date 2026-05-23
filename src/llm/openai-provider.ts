/**
 * OpenAI-compatible LLM provider using native fetch.
 *
 * Works with any API that follows the OpenAI chat completions format
 * (OpenAI, Azure OpenAI, Ollama, vLLM, etc). No SDK dependency.
 * Requires Node 18+ for native fetch.
 */

import type { LlmProvider, LlmExtractionResult, LlmRuleCandidate } from './types.js';
import { buildExtractionPrompt, parseExtractionResponse } from './extract.js';

/** Configuration for the OpenAI-compatible provider. */
export interface OpenAiProviderConfig {
  /** API key. Defaults to OPENAI_API_KEY env var. */
  apiKey?: string;
  /** Model to use. Defaults to 'gpt-4o-mini'. */
  model?: string;
  /** Base URL for the API. Defaults to 'https://api.openai.com/v1'. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /**
   * Total attempts on transient errors (429 and 503). Defaults to 3.
   * Set to 1 to disable retries. The first attempt counts.
   */
  maxAttempts?: number;
  /**
   * Initial backoff in milliseconds between retries. Doubled each
   * subsequent attempt. Honored only when the response has no
   * Retry-After header. Defaults to 1000.
   */
  retryBaseDelayMs?: number;
  /**
   * Sleep implementation, overridable for tests. Defaults to
   * setTimeout-based wait.
   */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Fetch implementation, overridable for tests. Defaults to global fetch.
   */
  fetchImpl?: typeof fetch;
}

/** Parse a Retry-After header into milliseconds. Returns null if absent or invalid. */
function parseRetryAfter(header: string | null): number | null {
  if (header === null || header === '') {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

/** Default sleep implementation using setTimeout. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an OpenAI-compatible LLM provider.
 *
 * Uses native fetch (Node 18+) to call the chat completions API.
 * No external dependencies required.
 *
 * @param config - Provider configuration
 * @returns An LlmProvider instance
 * @throws Error if no API key is available
 */
export function createOpenAiProvider(config: OpenAiProviderConfig = {}): LlmProvider {
  const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey in config.',
    );
  }

  const model = config.model ?? 'gpt-4o-mini';
  const baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 30000;
  const maxAttempts = Math.max(1, config.maxAttempts ?? 3);
  const retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
  const sleep = config.sleep ?? defaultSleep;
  const fetchFn = config.fetchImpl ?? fetch;

  return {
    name: `openai/${model}`,

    async extractRules(
      lines: string[],
      knownPatternTypes: string[],
    ): Promise<LlmExtractionResult> {
      if (lines.length === 0) {
        return { candidates: [], remaining: [] };
      }

      const prompt = buildExtractionPrompt(lines, knownPatternTypes);
      const body = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetchFn(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        // Retry only on 429 (rate limit) and 503 (service unavailable).
        // Other non-ok statuses surface as errors immediately because
        // they indicate a config or request problem retrying cannot
        // fix.
        const retryable = response.status === 429 || response.status === 503;
        if (!response.ok && retryable && attempt < maxAttempts) {
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
          const backoff = retryAfter ?? retryBaseDelayMs * Math.pow(2, attempt - 1);
          process.stderr.write(
            `OpenAI API returned ${response.status}; retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})\n`,
          );
          await sleep(backoff);
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(
            `OpenAI API error ${response.status}: ${errBody.slice(0, 200)}`,
          );
        }

        const data = await response.json() as {
          choices: Array<{ message: { content: string } }>;
        };

        const content = data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI API');
        }

        return parseExtractionResponse(content, lines, knownPatternTypes);
      }

      // Loop exits via return or throw; unreachable in practice.
      throw new Error('OpenAI API retries exhausted without a final response');
    },
  };
}
