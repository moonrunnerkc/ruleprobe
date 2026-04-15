/**
 * Structural delta computation between profile and target vectors.
 *
 * Computes the numeric differences that are passed to the LLM
 * for judgment. No raw code, only node type names and counts.
 */

import type { FeatureVector } from '../../types.js';

/** A node type that is expected but missing from the target. */
export interface MissingNodeType {
  nodeType: string;
  expectedCount: number;
}

/** A node type present in the target but absent from the profile. */
export interface ExtraNodeType {
  nodeType: string;
  actualCount: number;
}

/** Complete delta between a profile vector and a target vector. */
export interface StructuralDelta {
  /** Node types in profile but missing from target */
  missingFromTarget: MissingNodeType[];
  /** Node types in target but absent from profile */
  extraInTarget: ExtraNodeType[];
  /** Signatures present in profile but not in target */
  missingSignatures: string[];
  /** Signatures present in target but not in profile */
  extraSignatures: string[];
}

/**
 * Compute the structural delta between a profile and target vector.
 *
 * Identifies node types and signatures that differ between the
 * codebase profile and the target being verified.
 *
 * @param profileVector - Feature vector from the codebase profile
 * @param targetVector - Feature vector from the target
 * @returns The computed structural delta
 */
export function computeDelta(
  profileVector: FeatureVector,
  targetVector: FeatureVector,
): StructuralDelta {
  const missingFromTarget: MissingNodeType[] = [];
  const extraInTarget: ExtraNodeType[] = [];

  for (const [nodeType, count] of Object.entries(profileVector.nodeTypeCounts)) {
    const targetCount = targetVector.nodeTypeCounts[nodeType] ?? 0;
    if (targetCount === 0 && count > 0) {
      missingFromTarget.push({ nodeType, expectedCount: count });
    }
  }

  for (const [nodeType, count] of Object.entries(targetVector.nodeTypeCounts)) {
    const profileCount = profileVector.nodeTypeCounts[nodeType] ?? 0;
    if (profileCount === 0 && count > 0) {
      extraInTarget.push({ nodeType, actualCount: count });
    }
  }

  const profileSigs = new Set(profileVector.patternSignatures);
  const targetSigs = new Set(targetVector.patternSignatures);

  const missingSignatures = profileVector.patternSignatures.filter(
    (s) => !targetSigs.has(s),
  );
  const extraSignatures = targetVector.patternSignatures.filter(
    (s) => !profileSigs.has(s),
  );

  return { missingFromTarget, extraInTarget, missingSignatures, extraSignatures };
}

/**
 * Format a delta as a human-readable string for LLM prompts.
 *
 * Contains ONLY numeric data and node type names: no raw code.
 *
 * @param delta - The structural delta
 * @returns Formatted delta string
 */
export function formatDelta(delta: StructuralDelta): string {
  const lines: string[] = [];

  if (delta.missingFromTarget.length > 0) {
    lines.push('Node types in profile but missing from target:');
    for (const m of delta.missingFromTarget) {
      lines.push(`  ${m.nodeType}: expected ~${m.expectedCount.toFixed(1)}`);
    }
  }

  if (delta.extraInTarget.length > 0) {
    lines.push('Node types in target but absent from profile:');
    for (const e of delta.extraInTarget) {
      lines.push(`  ${e.nodeType}: found ${e.actualCount.toFixed(1)}`);
    }
  }

  if (delta.missingSignatures.length > 0) {
    lines.push(
      `Signature mismatches (in profile, not target): ${delta.missingSignatures.length}`,
    );
  }

  if (delta.extraSignatures.length > 0) {
    lines.push(
      `Signature mismatches (in target, not profile): ${delta.extraSignatures.length}`,
    );
  }

  if (lines.length === 0) {
    lines.push('No structural differences detected.');
  }

  return lines.join('\n');
}
