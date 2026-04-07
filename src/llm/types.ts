/**
 * Types for the LLM extraction provider system.
 *
 * Providers are pluggable: any object implementing LlmProvider
 * can be used. A built-in OpenAI provider is included.
 */

import type { RuleCategory, VerifierType } from '../types.js';

/**
 * A rule candidate extracted by an LLM from an unparseable line.
 * Fields mirror the core Rule type but without auto-generated IDs.
 */
export interface LlmRuleCandidate {
  /** Short identifier (will be prefixed with 'llm-'). */
  id: string;
  /** The rule category. */
  category: RuleCategory;
  /** What this rule checks. */
  description: string;
  /** Which verifier handles this rule. */
  verifier: VerifierType;
  /** The pattern type (must match an existing check). */
  patternType: string;
  /** The target (e.g. "*.ts"). */
  target: string;
  /** The expected value. */
  expected: string | boolean;
  /** Whether this is file-scoped or project-scoped. */
  scope: 'file' | 'project';
}

/**
 * Response from the LLM provider for a batch of unparseable lines.
 */
export interface LlmExtractionResult {
  /** Rules extracted from the input lines. */
  candidates: LlmRuleCandidate[];
  /** Lines the LLM could not map to any known check. */
  remaining: string[];
}

/**
 * Interface for LLM providers. Any compatible provider can be
 * plugged in by implementing this interface.
 */
export interface LlmProvider {
  /** Human-readable name for logging. */
  name: string;
  /**
   * Extract rule candidates from lines that static matching missed.
   *
   * @param lines - Unparseable lines from the instruction file
   * @param knownPatternTypes - List of pattern types the verifiers support
   * @returns Extracted candidates and remaining unmatched lines
   */
  extractRules(
    lines: string[],
    knownPatternTypes: string[],
  ): Promise<LlmExtractionResult>;
}

/**
 * Options for LLM-assisted extraction.
 */
export interface LlmExtractOptions {
  /** The LLM provider to use. */
  provider: LlmProvider;
  /** Maximum number of unparseable lines to send in one batch. Defaults to 50. */
  batchSize?: number;
}
