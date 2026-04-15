/**
 * Semantic judgment prompt builder for Layer 2 LLM escalation.
 *
 * Constructs typed prompts containing ONLY numeric data,
 * opaque hashes, and rule text. No raw code ever reaches
 * the prompt.
 */

import type { FeatureVector, PatternTopic } from '../../types.js';
import type { StructuralDelta } from '../comparison/structural-delta.js';
import { formatDelta } from '../comparison/structural-delta.js';

/**
 * LLM model identifier for semantic judgments.
 * Source: ASPE architecture spec; Sonnet 4.6 for cost efficiency.
 */
export const SEMANTIC_MODEL = 'claude-sonnet-4-6';

/**
 * Top N signatures to include in the prompt.
 * Limits prompt size while preserving the most prevalent patterns.
 */
const TOP_SIGNATURES = 5;

/** Parameters for building a semantic judgment prompt. */
export interface PromptParams {
  /** Pattern topic being verified */
  topic: PatternTopic;
  /** Codebase profile vector for this topic */
  profileVector: FeatureVector;
  /** Target vector being compared */
  targetVector: FeatureVector;
  /** Combined similarity score */
  similarityScore: number;
  /** Fast-path threshold that was not met */
  fastPathThreshold: number;
  /** Structural delta between profile and target */
  delta: StructuralDelta;
  /** Original rule text */
  ruleText: string;
  /** Number of files that contributed to the profile */
  sampleSize: number;
}

/**
 * Build a semantic judgment prompt for LLM escalation.
 *
 * The prompt contains ONLY:
 * - Numeric node type distributions
 * - Nesting depth averages
 * - Opaque signature hashes with prevalence
 * - The original rule text
 * - Numeric delta between profile and target
 *
 * It NEVER contains: raw code, variable names, function names,
 * string literals, comments, import paths, module names, file paths,
 * or scope names.
 *
 * @param params - All data needed for the prompt
 * @returns The complete prompt string
 */
export function buildSemanticPrompt(params: PromptParams): string {
  const {
    topic,
    profileVector,
    targetVector,
    similarityScore,
    fastPathThreshold,
    delta,
    ruleText,
    sampleSize,
  } = params;

  const topProfileSigs = profileVector.patternSignatures.slice(0, TOP_SIGNATURES);
  const topTargetSigs = targetVector.patternSignatures.slice(0, TOP_SIGNATURES);

  const promptParts: string[] = [
    'You are verifying whether code follows an established codebase pattern.',
    '',
    `CODEBASE PATTERN PROFILE (topic: "${topic}"):`,
    `- Node type distribution: ${formatCounts(profileVector.nodeTypeCounts)}`,
    `- Nesting depth averages: ${formatCounts(profileVector.nestingDepths)}`,
    `- Dominant pattern signatures: ${formatSignatures(topProfileSigs, profileVector.prevalence)}`,
    `- Sample size: ${sampleSize} files`,
    '',
    'TARGET CODE VECTOR:',
    `- Node type distribution: ${formatCounts(targetVector.nodeTypeCounts)}`,
    `- Nesting depth averages: ${formatCounts(targetVector.nestingDepths)}`,
    `- Pattern signatures present: ${formatSignatures(topTargetSigs, targetVector.prevalence)}`,
    '',
    `VECTOR SIMILARITY: ${similarityScore.toFixed(4)} (below threshold ${fastPathThreshold.toFixed(4)})`,
    '',
    'NUMERIC DELTA:',
    formatDelta(delta),
    '',
    `RULE BEING VERIFIED: "${ruleText}"`,
    '',
    `Does the target code's structural approach to "${topic}" align with the codebase's established pattern?`,
    '',
    'Respond with ONLY a JSON object:',
    '{',
    '  "compliance": <number 0-1>,',
    '  "reasoning": "<one sentence>",',
    '  "violations": ["<structural mismatches, node types and signatures only>"],',
    '  "mitigations": ["<reasons mismatches might be intentional>"]',
    '}',
  ];

  return promptParts.join('\n');
}

/**
 * Format a counts record as "key:value" pairs.
 *
 * @param counts - Record of string to number
 * @returns Formatted string of key:value pairs
 */
function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return '(none)';
  }
  return entries
    .map(([key, value]) => `${key}:${value.toFixed(1)}`)
    .join(', ');
}

/**
 * Format signatures as hash:prevalence pairs.
 *
 * @param sigs - Array of signature hashes
 * @param prevalence - Topic prevalence
 * @returns Formatted string
 */
function formatSignatures(sigs: string[], prevalence: number): string {
  if (sigs.length === 0) {
    return '(none)';
  }
  return sigs
    .map((s) => `${s.slice(0, 12)}... (prevalence: ${prevalence.toFixed(2)})`)
    .join(', ');
}
