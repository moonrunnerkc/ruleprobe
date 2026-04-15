/**
 * Qualifier resolver: maps qualifier types and structural context
 * to compliance score adjustments.
 *
 * When a qualified rule is violated, the resolver determines whether
 * the violation is justified by structural context flags and adjusts
 * the compliance score accordingly.
 */

import type {
  QualifierType,
  QualifierContext,
  SemanticVerdict,
  StructuralViolation,
} from '../../types.js';
import { countTrueFlags } from './context-analyzer.js';

/**
 * Compliance score when 1 context flag is true.
 * Source: ASPE architecture spec. One structural justification
 * yields a "justified deviation" score.
 */
const ONE_FLAG_COMPLIANCE = 0.6;

/**
 * Compliance score when 2+ context flags are true.
 * Source: ASPE architecture spec. Multiple structural justifications
 * provide stronger evidence.
 */
const MULTI_FLAG_COMPLIANCE = 0.7;

/**
 * Compliance score for soft qualifiers (when-possible, try-to)
 * with zero structural justification.
 * Source: ASPE architecture spec. Unjustified soft-rule deviation
 * gets a low score without LLM escalation.
 */
const UNJUSTIFIED_SOFT_COMPLIANCE = 0.2;

/**
 * Compliance score when LLM confirms justification with high confidence.
 * Source: ASPE architecture spec. justified + confidence > 0.8.
 */
const LLM_JUSTIFIED_HIGH_COMPLIANCE = 0.6;

/**
 * Compliance score when LLM confirms justification with moderate confidence.
 * Source: ASPE architecture spec. justified + confidence 0.5-0.8.
 */
const LLM_JUSTIFIED_MODERATE_COMPLIANCE = 0.4;

/**
 * Compliance score when LLM finds no justification.
 * Source: ASPE architecture spec. Never 0.0 for qualified rules.
 */
const LLM_NOT_JUSTIFIED_COMPLIANCE = 0.1;

/**
 * Confidence threshold for high vs moderate LLM justification.
 */
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Confidence threshold for moderate justification lower bound.
 */
const MODERATE_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Result of qualifier resolution: either resolved deterministically
 * or needs LLM escalation.
 */
export interface QualifierResolution {
  /** Whether this was resolved without LLM */
  resolved: boolean;
  /** Compliance score if resolved */
  compliance: number | null;
  /** Whether LLM escalation is needed */
  needsLlm: boolean;
  /** Why this resolution was chosen */
  reasoning: string;
}

/**
 * LLM judgment for qualifier escalation.
 */
export interface QualifierLlmJudgment {
  justified: boolean;
  reason: string;
  confidence: number;
}

/**
 * Resolve a qualified rule violation deterministically when possible.
 *
 * Qualifier handling:
 * - always/never: no Layer 3 needed (handled by deterministic matchers or Layer 2)
 * - prefer: no Layer 3 needed (handled by v2.0.0 or Layer 2)
 * - when-possible, try-to: soft qualifiers, resolved by context flags
 * - avoid-unless: hard qualifier, needs LLM if no flags justify
 *
 * @param qualifier - The qualifier type on the rule
 * @param context - The structural context flags
 * @returns Resolution result, possibly requiring LLM escalation
 */
export function resolveQualifier(
  qualifier: QualifierType,
  context: QualifierContext,
): QualifierResolution {
  const flagCount = countTrueFlags(context);

  if (qualifier === 'always' || qualifier === 'never' || qualifier === 'prefer') {
    return {
      resolved: true,
      compliance: null,
      needsLlm: false,
      reasoning: `Qualifier "${qualifier}" is handled by deterministic matchers or Layer 2`,
    };
  }

  if (flagCount >= 2) {
    return {
      resolved: true,
      compliance: MULTI_FLAG_COMPLIANCE,
      needsLlm: false,
      reasoning: `${flagCount} structural justifications found (strong justification)`,
    };
  }

  if (flagCount === 1) {
    return {
      resolved: true,
      compliance: ONE_FLAG_COMPLIANCE,
      needsLlm: false,
      reasoning: '1 structural justification found (justified deviation)',
    };
  }

  if (qualifier === 'when-possible' || qualifier === 'try-to') {
    return {
      resolved: true,
      compliance: UNJUSTIFIED_SOFT_COMPLIANCE,
      needsLlm: false,
      reasoning: `Soft qualifier "${qualifier}" violated with no structural justification`,
    };
  }

  if (qualifier === 'avoid-unless') {
    return {
      resolved: false,
      compliance: null,
      needsLlm: true,
      reasoning: 'Hard qualifier "avoid-unless" violated with no structural justification; needs LLM',
    };
  }

  return {
    resolved: true,
    compliance: UNJUSTIFIED_SOFT_COMPLIANCE,
    needsLlm: false,
    reasoning: `Unknown qualifier "${qualifier}" treated as soft`,
  };
}

/**
 * Apply an LLM judgment to produce a final compliance score.
 *
 * Score mapping:
 * - justified + confidence > 0.8 = 0.6
 * - justified + confidence 0.5-0.8 = 0.4 (flag for review)
 * - not justified = 0.1 (never 0.0 for qualified rules)
 *
 * @param judgment - LLM response for the qualifier escalation
 * @returns compliance score
 */
export function applyLlmJudgment(judgment: QualifierLlmJudgment): number {
  if (!judgment.justified) {
    return LLM_NOT_JUSTIFIED_COMPLIANCE;
  }
  if (judgment.confidence > HIGH_CONFIDENCE_THRESHOLD) {
    return LLM_JUSTIFIED_HIGH_COMPLIANCE;
  }
  if (judgment.confidence >= MODERATE_CONFIDENCE_THRESHOLD) {
    return LLM_JUSTIFIED_MODERATE_COMPLIANCE;
  }
  return LLM_NOT_JUSTIFIED_COMPLIANCE;
}

/**
 * Build a SemanticVerdict for a qualifier-resolved rule.
 *
 * @param ruleId - The rule identifier
 * @param compliance - Resolved compliance score
 * @param method - Whether structural or LLM-assisted
 * @param reasoning - Explanation of the resolution
 * @param profileHash - Hash of the structural profile
 * @param tokenCost - LLM tokens used (0 for deterministic)
 * @param violations - Structural violations found
 * @param mitigations - Reasons the deviation might be justified
 * @returns SemanticVerdict
 */
export function buildQualifierVerdict(
  ruleId: string,
  compliance: number,
  method: 'structural-fast-path' | 'llm-assisted',
  reasoning: string,
  profileHash: string,
  tokenCost: number,
  violations: StructuralViolation[],
  mitigations: string[],
): SemanticVerdict {
  return {
    ruleId,
    compliance,
    method,
    reasoning,
    violations,
    mitigations,
    profileHash,
    tokenCost,
  };
}
