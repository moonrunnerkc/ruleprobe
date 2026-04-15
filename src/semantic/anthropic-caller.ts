/**
 * Anthropic API proxy for LLM calls.
 *
 * Wraps the Anthropic Messages API to provide a simple
 * LlmCaller interface that the semantic engine consumes.
 * Uses native fetch to avoid SDK dependencies.
 */

/**
 * Default Anthropic API endpoint.
 */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * API version header value.
 */
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Request timeout in milliseconds.
 *
 * Source: Anthropic API can take up to 60 seconds for complex prompts.
 */
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Maximum tokens for response.
 *
 * Source: semantic judgment responses are concise JSON objects.
 */
const MAX_RESPONSE_TOKENS = 1024;

/** Configuration for the Anthropic proxy. */
export interface AnthropicProxyConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Optional API URL override (for testing) */
  apiUrl?: string;
  /** Optional timeout override */
  timeoutMs?: number;
}

/** Result from an LLM call. */
export interface LlmCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Create an LLM caller function backed by the Anthropic API.
 *
 * Returns a function matching the LlmCaller signature expected
 * by ruleprobe-semantic's analyzeSemantic().
 *
 * @param config - Anthropic proxy configuration
 * @returns LLM caller function
 */
export function createAnthropicCaller(
  config: AnthropicProxyConfig,
): (model: string, prompt: string) => Promise<string> {
  const apiUrl = config.apiUrl ?? ANTHROPIC_API_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;

  return async (model: string, prompt: string): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_RESPONSE_TOKENS,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Anthropic API returned ${String(response.status)}: ${body.slice(0, 200)}`,
        );
      }

      const data = await response.json() as AnthropicResponse;
      const textBlock = data.content?.find((c) => c.type === 'text');
      return textBlock?.text ?? '';
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Expected shape of an Anthropic Messages API response. */
interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}
