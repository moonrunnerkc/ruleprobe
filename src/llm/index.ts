/**
 * LLM extraction module entry point.
 *
 * Re-exports types, providers, and the extraction pipeline.
 */

export type {
  LlmProvider,
  LlmRuleCandidate,
  LlmExtractionResult,
  LlmExtractOptions,
} from './types.js';
export { createOpenAiProvider } from './openai-provider.js';
export type { OpenAiProviderConfig } from './openai-provider.js';
export { buildExtractionPrompt, parseExtractionResponse } from './extract.js';
export { extractWithLlm } from './pipeline.js';
