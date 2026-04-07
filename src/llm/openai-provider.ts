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

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `OpenAI API error ${response.status}: ${body.slice(0, 200)}`,
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
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
