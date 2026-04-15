/**
 * LLM escalation logic for semantic and qualifier resolution.
 *
 * Separated from rule-resolver.ts to respect the 300-line file limit.
 */

import type {
  FeatureVector,
  ExtractedRulePayload,
  SemanticVerdict,
  StructuralProfile,
  RawExtractionPayload,
} from '../types.js';
import { computeDelta } from './comparison/structural-delta.js';
import { buildSemanticPrompt, SEMANTIC_MODEL } from './llm/prompt-builder.js';
import { validateResponse, inconclusiveResponse } from './llm/response-validator.js';
import { analyzeContext, countTrueFlags } from './qualifiers/context-analyzer.js';
import { resolveQualifier, applyLlmJudgment, buildQualifierVerdict } from './qualifiers/qualifier-resolver.js';
import { buildQualifierPrompt } from './llm/qualifier-prompt-builder.js';
import type { LlmCaller } from '../types.js';
import type { RuleResolutionResult } from './rule-resolver.js';

/**
 * Maximum LLM retries for response validation.
 * On second failure, returns inconclusive.
 */
const MAX_LLM_RETRIES = 1;

/**
 * Resolve a rule via LLM escalation (Layer 2).
 *
 * Called when fast-path could not resolve the rule and
 * it is not a qualified rule needing Layer 3.
 */
export async function resolveLlmEscalation(
  rule: ExtractedRulePayload,
  topicName: string,
  profileVector: FeatureVector,
  targetVector: FeatureVector,
  similarity: number,
  threshold: number,
  profile: StructuralProfile,
  payload: RawExtractionPayload,
  llmCaller: LlmCaller,
  currentLlmCalls: number,
  maxLlmCalls: number,
): Promise<RuleResolutionResult> {
  if (currentLlmCalls >= maxLlmCalls) {
    return llmBudgetExhausted(rule, profile.profileId, similarity);
  }

  const delta = computeDelta(profileVector, targetVector);

  const prompt = buildSemanticPrompt({
    topic: topicName,
    profileVector,
    targetVector,
    similarityScore: similarity,
    fastPathThreshold: threshold,
    delta,
    ruleText: rule.ruleText,
    sampleSize: profile.sampleSize,
  });

  let llmCallsUsed = 0;
  let retries = 0;

  while (retries <= MAX_LLM_RETRIES) {
    const rawResponse = await llmCaller(SEMANTIC_MODEL, prompt);
    llmCallsUsed += 1;
    const validation = validateResponse(rawResponse);

    if (validation.valid && validation.response) {
      const verdict: SemanticVerdict = {
        ruleId: rule.ruleId,
        compliance: validation.response.compliance,
        method: 'llm-assisted',
        reasoning: validation.response.reasoning,
        violations: validation.response.violations.map((v) => ({
          feature: topicName,
          location: 'structural-vector',
          expected: 'profile-aligned',
          found: v,
        })),
        mitigations: validation.response.mitigations,
        profileHash: profile.profileId,
        tokenCost: estimateTokenCost(prompt, rawResponse),
      };
      return { verdict, llmCallsUsed };
    }

    retries += 1;
  }

  const fallback = inconclusiveResponse();
  const verdict: SemanticVerdict = {
    ruleId: rule.ruleId,
    compliance: fallback.compliance,
    method: 'llm-assisted',
    reasoning: fallback.reasoning,
    violations: [],
    mitigations: [],
    profileHash: profile.profileId,
    tokenCost: estimateTokenCost(prompt, ''),
  };
  return { verdict, llmCallsUsed };
}

/**
 * Resolve a qualified rule (when-possible, avoid-unless, try-to).
 *
 * Uses Layer 3 qualifier resolution with context flags.
 * Only escalates to LLM for "avoid-unless" with no flags.
 */
export async function resolveQualifiedRule(
  rule: ExtractedRulePayload,
  profileVector: FeatureVector,
  targetVector: FeatureVector,
  profile: StructuralProfile,
  payload: RawExtractionPayload,
  llmCaller: LlmCaller,
  currentLlmCalls: number,
  maxLlmCalls: number,
): Promise<RuleResolutionResult> {
  const fileIds = Object.keys(payload.fileVectors);
  const totalFiles = fileIds.length;
  const firstFileId = fileIds[0] ?? '';
  const firstVector = payload.fileVectors[firstFileId];

  const context = firstVector
    ? analyzeContext(firstVector, 0, totalFiles)
    : {
        inTightLoop: false,
        thirdPartyBoundary: false,
        deviationCommentPresent: false,
        frameworkConstraintDetected: false,
        legacyCodeRegion: false,
        testCode: false,
        variableReassigned: false,
      };

  const resolution = resolveQualifier(rule.qualifier, context);

  if (resolution.resolved && resolution.compliance !== null) {
    const mitigations = buildMitigations(context);
    const verdict = buildQualifierVerdict(
      rule.ruleId,
      resolution.compliance,
      'structural-fast-path',
      resolution.reasoning,
      profile.profileId,
      0,
      [],
      mitigations,
    );
    return { verdict, llmCallsUsed: 0 };
  }

  if (resolution.needsLlm) {
    return resolveQualifierLlm(
      rule,
      profileVector,
      targetVector,
      context,
      profile,
      llmCaller,
      currentLlmCalls,
      maxLlmCalls,
    );
  }

  const verdict = buildQualifierVerdict(
    rule.ruleId,
    resolution.compliance ?? 0.5,
    'structural-fast-path',
    resolution.reasoning,
    profile.profileId,
    0,
    [],
    [],
  );
  return { verdict, llmCallsUsed: 0 };
}

/** Resolve qualifier via LLM (avoid-unless with no flags). */
async function resolveQualifierLlm(
  rule: ExtractedRulePayload,
  profileVector: FeatureVector,
  targetVector: FeatureVector,
  context: ReturnType<typeof analyzeContext>,
  profile: StructuralProfile,
  llmCaller: LlmCaller,
  currentLlmCalls: number,
  maxLlmCalls: number,
): Promise<RuleResolutionResult> {
  if (currentLlmCalls >= maxLlmCalls) {
    const verdict = buildQualifierVerdict(
      rule.ruleId,
      0.1,
      'structural-fast-path',
      'LLM budget exhausted; default low',
      profile.profileId,
      0,
      [],
      [],
    );
    return { verdict, llmCallsUsed: 0 };
  }

  const delta = computeDelta(profileVector, targetVector);
  const prompt = buildQualifierPrompt({
    ruleText: rule.ruleText,
    qualifierType: rule.qualifier,
    context,
    delta,
  });

  const rawResponse = await llmCaller(SEMANTIC_MODEL, prompt);
  let judgment: { justified: boolean; reason: string; confidence: number };

  try {
    const parsed = JSON.parse(rawResponse) as Record<string, unknown>;
    judgment = {
      justified: Boolean(parsed['justified']),
      reason: String(parsed['reason'] ?? ''),
      confidence: Number(parsed['confidence'] ?? 0),
    };
  } catch {
    judgment = { justified: false, reason: 'Could not parse LLM response', confidence: 0 };
  }

  const compliance = applyLlmJudgment(judgment);
  const mitigations = judgment.justified ? [judgment.reason] : [];

  const verdict = buildQualifierVerdict(
    rule.ruleId,
    compliance,
    'llm-assisted',
    judgment.reason || 'LLM qualifier judgment',
    profile.profileId,
    estimateTokenCost(prompt, rawResponse),
    [],
    mitigations,
  );
  return { verdict, llmCallsUsed: 1 };
}

/** Build mitigations from context flags. */
function buildMitigations(
  context: ReturnType<typeof analyzeContext>,
): string[] {
  const m: string[] = [];
  if (context.inTightLoop) m.push('Code is in a tight loop (performance constraint)');
  if (context.thirdPartyBoundary) m.push('Third-party boundary detected');
  if (context.deviationCommentPresent) m.push('Deviation comment present');
  if (context.frameworkConstraintDetected) m.push('Framework constraint detected');
  if (context.legacyCodeRegion) m.push('Legacy code region');
  if (context.testCode) m.push('Test code');
  return m;
}

/** Build a verdict for exhausted LLM budget. */
function llmBudgetExhausted(
  rule: ExtractedRulePayload,
  profileHash: string,
  similarity: number,
): RuleResolutionResult {
  return {
    verdict: {
      ruleId: rule.ruleId,
      compliance: similarity,
      method: 'structural-fast-path',
      reasoning: 'LLM budget exhausted; using raw similarity score',
      violations: [],
      mitigations: [],
      profileHash,
      tokenCost: 0,
    },
    llmCallsUsed: 0,
  };
}

/**
 * Estimate token cost from prompt and response lengths.
 * Rough estimate: ~4 chars per token.
 *
 * Source: Common industry approximation for English text.
 */
const CHARS_PER_TOKEN = 4;

/** Estimate token cost from prompt and response text. */
function estimateTokenCost(prompt: string, response: string): number {
  return Math.ceil((prompt.length + response.length) / CHARS_PER_TOKEN);
}
