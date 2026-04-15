/**
 * Public API for semantic analysis.
 *
 * Orchestrates the semantic analysis pipeline: local extraction of
 * raw AST vectors, direct invocation of the semantic engine, and
 * integration of semantic verdicts into the project analysis result.
 */

import type {
  SemanticAnalysisConfig,
  SemanticAnalysisReport,
  SemanticVerdict,
  RawExtractionPayload,
  ExtractedRulePayload,
} from './types.js';
import type { ProjectAnalysis, Rule } from '../types.js';
import { extractRawVectors } from './local-extractor.js';
import { analyzeSemantic } from './engine/index.js';
import { createAnthropicCaller } from './anthropic-caller.js';

/** Result of the semantic analysis pipeline. */
export interface SemanticPipelineResult {
  /** Whether semantic analysis was performed. */
  performed: boolean;
  /** Reason semantic analysis was skipped, if applicable. */
  skipReason?: string;
  /** Verdicts from the semantic engine. */
  verdicts: SemanticVerdict[];
  /** Full report from the semantic engine. */
  report?: SemanticAnalysisReport;
  /** The raw payload that was sent (for audit logging). */
  sentPayload?: RawExtractionPayload;
}

/**
 * Run semantic analysis on a project.
 *
 * 1. Extract raw AST vectors locally (single-pass tree-sitter scan)
 * 2. Create a local LLM caller from the Anthropic API key
 * 3. Run the semantic engine directly (no HTTP, no server)
 * 4. Return verdicts for integration into the project analysis
 *
 * @param projectDir - Root directory of the project being analyzed
 * @param config - Resolved semantic analysis configuration
 * @param rules - Rules extracted from instruction files (for payload enrichment)
 * @returns Pipeline result with verdicts or skip reason
 */
export async function analyzeProjectSemantic(
  projectDir: string,
  config: SemanticAnalysisConfig,
  rules: Rule[],
): Promise<SemanticPipelineResult> {
  const payload = await extractRawVectors(projectDir);

  payload.rules = rules.map(ruleToPayload);

  const llmCaller = createAnthropicCaller({
    apiKey: config.anthropicApiKey,
  });

  const report = await analyzeSemantic(payload, llmCaller, {
    fastPathThreshold: config.fastPathThreshold,
    maxLlmCalls: config.maxLlmCalls,
    useCache: config.useCache,
  });

  return {
    performed: true,
    verdicts: report.verdicts,
    report,
    sentPayload: payload,
  };
}

/**
 * Convert an internal Rule to an ExtractedRulePayload for transmission.
 *
 * @param rule - Internal rule from the instruction file parser
 * @returns Rule payload safe for semantic analysis
 */
function ruleToPayload(rule: Rule): ExtractedRulePayload {
  return {
    ruleId: rule.id,
    ruleText: rule.source,
    qualifier: rule.qualifier ?? 'always',
    section: rule.section,
    confidence: rule.confidence === 'high' ? 1.0 : rule.confidence === 'medium' ? 0.7 : 0.4,
  };
}

/**
 * Integrate semantic verdicts into a ProjectAnalysis result.
 *
 * Attaches the semantic report as an additional property on the analysis.
 * Does not modify existing deterministic results.
 *
 * @param analysis - Existing project analysis from deterministic pipeline
 * @param pipelineResult - Result from the semantic analysis pipeline
 * @returns Updated project analysis (same reference, mutated for efficiency)
 */
export function integrateSemanticResults(
  analysis: ProjectAnalysis,
  pipelineResult: SemanticPipelineResult,
): ProjectAnalysis {
  const extended = analysis as ProjectAnalysis & {
    semantic?: {
      performed: boolean;
      skipReason?: string;
      verdicts: SemanticVerdict[];
      report?: SemanticAnalysisReport;
    };
  };

  extended.semantic = {
    performed: pipelineResult.performed,
    skipReason: pipelineResult.skipReason,
    verdicts: pipelineResult.verdicts,
    report: pipelineResult.report,
  };

  return extended;
}
