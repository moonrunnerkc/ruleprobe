/**
 * Qualifier-specific LLM prompt builder.
 *
 * Builds prompts for "avoid-unless" rules where no structural flag
 * justified the deviation. These are the rarest LLM calls in the system.
 *
 * PRIVACY: prompts contain ONLY rule text, boolean flags, numeric deltas,
 * and qualifier type. No raw code, variable names, file paths, or comments.
 */

import type { QualifierType, QualifierContext } from '../../types.js';
import type { StructuralDelta } from '../comparison/structural-delta.js';
import { formatDelta } from '../comparison/structural-delta.js';

/**
 * Parameters for building a qualifier escalation prompt.
 */
export interface QualifierPromptParams {
  /** The original rule text */
  ruleText: string;
  /** The qualifier type */
  qualifierType: QualifierType;
  /** The qualifier context (all boolean flags) */
  context: QualifierContext;
  /** The numeric feature vector delta */
  delta: StructuralDelta;
}

/**
 * Build an LLM prompt for qualifier escalation.
 *
 * Only called for "avoid-unless" rules where all context flags are false.
 * The prompt asks whether there is a structural reason the deviation
 * might be justified.
 *
 * @param params - Prompt parameters with no raw code
 * @returns The formatted prompt string
 */
export function buildQualifierPrompt(params: QualifierPromptParams): string {
  const { ruleText, qualifierType, context, delta } = params;
  const formattedDelta = formatDelta(delta);

  return [
    `A coding rule states: "${ruleText}"`,
    `Qualifier type: "${qualifierType}" (exceptions acceptable when justified)`,
    '',
    'The code violates this rule. No structural justification found:',
    `- In tight loop: ${String(context.inTightLoop)}`,
    `- Third-party boundary: ${String(context.thirdPartyBoundary)}`,
    `- Deviation comment present: ${String(context.deviationCommentPresent)}`,
    `- Framework constraint: ${String(context.frameworkConstraintDetected)}`,
    `- Legacy code region: ${String(context.legacyCodeRegion)}`,
    `- Test code: ${String(context.testCode)}`,
    `- Variable reassigned: ${String(context.variableReassigned)}`,
    '',
    'Feature vector delta:',
    formattedDelta,
    '',
    'Is there a structural reason this deviation might be justified?',
    '',
    'Respond with ONLY a JSON object:',
    '{',
    '  "justified": <boolean>,',
    '  "reason": "<one sentence>",',
    '  "confidence": <number 0-1>',
    '}',
  ].join('\n');
}

/**
 * Validate that a qualifier prompt contains no raw code.
 *
 * This is a defense-in-depth check. The prompt should only contain
 * rule text, boolean values, and numeric data.
 *
 * @param prompt - The built prompt
 * @returns true if the prompt is safe (no raw code indicators)
 */
export function validateQualifierPromptPrivacy(prompt: string): boolean {
  const codeIndicators = [
    /\bfunction\s+\w+\s*\(/,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bvar\s+\w+\s*=/,
    /\bclass\s+\w+\s*\{/,
    /\bimport\s+.*\s+from\s+['"]/,
    /\brequire\s*\(\s*['"]/,
    /=>\s*\{/,
  ];

  for (const pattern of codeIndicators) {
    if (pattern.test(prompt)) {
      return false;
    }
  }
  return true;
}
