/**
 * Public API for semantic analysis.
 *
 * Orchestrates the semantic analysis pipeline: local extraction of
 * raw AST vectors, remote analysis via the API service, and integration
 * of semantic verdicts into the project analysis result.
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
import { validateLicense, analyzeRemote } from './client.js';
import type { AnalyzeResponse } from './client.js';

/** Result of the semantic analysis pipeline. */
export interface SemanticPipelineResult {
  /** Whether semantic analysis was performed. */
  performed: boolean;
  /** Reason semantic analysis was skipped, if applicable. */
  skipReason?: string;
  /** Verdicts from the API service. */
  verdicts: SemanticVerdict[];
  /** Full report from the API service. */
  report?: SemanticAnalysisReport;
  /** The raw payload that was sent (for audit logging). */
  sentPayload?: RawExtractionPayload;
  /** The raw response received (for audit logging). */
  rawResponse?: AnalyzeResponse;
}

/**
 * Run semantic analysis on a project.
 *
 * 1. Extract raw AST vectors locally (single-pass tree-sitter scan)
 * 2. Validate license key with the API service
 * 3. Send raw vectors to the API for semantic analysis
 * 4. Return verdicts for integration into the project analysis
 *
 * Degrades gracefully: if the API is unreachable or the license is invalid,
 * returns a result indicating semantic analysis was skipped.
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

  const licenseResult = await validateLicense(config);
  if (licenseResult === null) {
    return {
      performed: false,
      skipReason: 'Could not validate license key. Check your network connection and API endpoint.',
      verdicts: [],
      sentPayload: payload,
    };
  }

  if (!licenseResult.valid) {
    return {
      performed: false,
      skipReason: 'License key is invalid or expired. Check your license key configuration.',
      verdicts: [],
      sentPayload: payload,
    };
  }

  if (licenseResult.callsRemaining <= 0) {
    return {
      performed: false,
      skipReason: 'No API calls remaining on this license. Upgrade your plan or wait for the next billing cycle.',
      verdicts: [],
      sentPayload: payload,
    };
  }

  const response = await analyzeRemote(config, payload);
  if (response === null) {
    return {
      performed: false,
      skipReason: 'Semantic analysis API did not respond. Deterministic analysis continues without semantic results.',
      verdicts: [],
      sentPayload: payload,
    };
  }

  return {
    performed: true,
    verdicts: response.report.verdicts,
    report: response.report,
    sentPayload: payload,
    rawResponse: response,
  };
}

/**
 * Convert an internal Rule to an ExtractedRulePayload for transmission.
 *
 * @param rule - Internal rule from the instruction file parser
 * @returns Rule payload safe for API transmission
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
