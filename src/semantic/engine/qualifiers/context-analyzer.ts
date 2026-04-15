/**
 * Context analyzer for qualifier resolution.
 *
 * Extracts boolean QualifierContext flags from raw vectors
 * to determine whether a qualified rule deviation is justified.
 */

import type { QualifierContext, RawFileVector } from '../../types.js';

/**
 * Nesting depth threshold above which a loop is considered "tight."
 *
 * Source: ASPE architecture spec. A nesting depth > 2 for
 * loop constructs indicates tight-loop code where performance
 * constraints may justify deviations.
 */
const TIGHT_LOOP_DEPTH_THRESHOLD = 2;

/**
 * Flag prefix used in nodeTypeCounts for boolean metadata.
 * Must match the prefix used by local-extractor.ts.
 */
const FLAG_PREFIX = '__flag:';

/** Deviation comment flag key. */
const DEVIATION_COMMENT_FLAG = `${FLAG_PREFIX}deviationComment`;

/** Test code flag key. */
const TEST_CODE_FLAG = `${FLAG_PREFIX}testCode`;

/**
 * AST node types indicating third-party/external module calls.
 * Presence of these in significant quantity suggests a third-party boundary.
 */
const THIRD_PARTY_NODE_TYPES = [
  'call_expression',
  'member_expression',
  'import_statement',
];

/**
 * Minimum count of third-party-indicative node types to flag.
 * Prevents false positives from normal code.
 */
const THIRD_PARTY_MIN_COUNT = 10;

/**
 * Framework-specific AST patterns that indicate framework constraints.
 * Files with these patterns may be forced into certain structures by
 * the framework.
 */
const FRAMEWORK_NODE_TYPES = [
  'export_statement',
  'jsx_element',
  'jsx_self_closing_element',
];

/**
 * Minimum framework node count to trigger the flag.
 */
const FRAMEWORK_MIN_COUNT = 5;

/**
 * Minimum count of reassignment node types to flag variableReassigned.
 * A single assignment_expression or update_expression is enough to
 * indicate the variable mutation pattern is in use.
 *
 * Source: structural observation; any reassignment justifies `let` usage.
 */
const REASSIGNMENT_MIN_COUNT = 1;

/**
 * AST node types indicating variable reassignment.
 */
const REASSIGNMENT_NODE_TYPES = [
  'assignment_expression',
  'update_expression',
  'augmented_assignment_expression',
];

/**
 * Analyze a raw file vector to extract QualifierContext boolean flags.
 *
 * Each flag provides structural evidence for whether a rule
 * deviation might be justified. No raw code is accessed.
 *
 * @param vector - The raw file vector for the target file
 * @param fileOrder - The file's position in content-hash ordering (0-based)
 * @param totalFiles - Total number of files in the codebase
 * @returns QualifierContext with all boolean flags
 */
export function analyzeContext(
  vector: RawFileVector,
  fileOrder: number,
  totalFiles: number,
): QualifierContext {
  return {
    inTightLoop: checkTightLoop(vector),
    thirdPartyBoundary: checkThirdPartyBoundary(vector),
    deviationCommentPresent: checkDeviationComment(vector),
    frameworkConstraintDetected: checkFrameworkConstraint(vector),
    legacyCodeRegion: checkLegacyRegion(fileOrder, totalFiles),
    testCode: checkTestCode(vector),
    variableReassigned: checkVariableReassigned(vector),
  };
}

/**
 * Count how many context flags are true.
 *
 * @param ctx - The qualifier context
 * @returns Number of true flags
 */
export function countTrueFlags(ctx: QualifierContext): number {
  let count = 0;
  if (ctx.inTightLoop) count += 1;
  if (ctx.thirdPartyBoundary) count += 1;
  if (ctx.deviationCommentPresent) count += 1;
  if (ctx.frameworkConstraintDetected) count += 1;
  if (ctx.legacyCodeRegion) count += 1;
  if (ctx.testCode) count += 1;
  if (ctx.variableReassigned) count += 1;
  return count;
}

/**
 * Check if the file has tight loop nesting (depth > threshold).
 */
function checkTightLoop(vector: RawFileVector): boolean {
  const loopTypes = ['for_statement', 'for_in_statement', 'while_statement', 'do_statement'];
  for (const lt of loopTypes) {
    const depth = vector.nestingDepths[lt] ?? 0;
    if (depth > TIGHT_LOOP_DEPTH_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the file is at a third-party boundary.
 */
function checkThirdPartyBoundary(vector: RawFileVector): boolean {
  let total = 0;
  for (const nt of THIRD_PARTY_NODE_TYPES) {
    total += vector.nodeTypeCounts[nt] ?? 0;
  }
  return total >= THIRD_PARTY_MIN_COUNT;
}

/**
 * Check if a deviation comment is present.
 * Uses the boolean flag from local-extractor.ts.
 */
function checkDeviationComment(vector: RawFileVector): boolean {
  return (vector.nodeTypeCounts[DEVIATION_COMMENT_FLAG] ?? 0) > 0;
}

/**
 * Check if framework constraints are detected.
 */
function checkFrameworkConstraint(vector: RawFileVector): boolean {
  let total = 0;
  for (const nt of FRAMEWORK_NODE_TYPES) {
    total += vector.nodeTypeCounts[nt] ?? 0;
  }
  return total >= FRAMEWORK_MIN_COUNT;
}

/**
 * Check if the file is in the oldest 20% by content hash order.
 * Content hash ordering is deterministic and approximates file age.
 */
function checkLegacyRegion(fileOrder: number, totalFiles: number): boolean {
  if (totalFiles === 0) return false;
  /**
   * Legacy threshold: files in the oldest 20% of the codebase.
   * Source: ASPE architecture spec.
   */
  const LEGACY_PERCENTILE = 0.2;
  return fileOrder / totalFiles < LEGACY_PERCENTILE;
}

/**
 * Check if the file is test code.
 * Uses the boolean flag from local-extractor.ts.
 */
function checkTestCode(vector: RawFileVector): boolean {
  return (vector.nodeTypeCounts[TEST_CODE_FLAG] ?? 0) > 0;
}

/**
 * Check if the file contains variable reassignment patterns.
 * Returns true when any reassignment node type count meets the minimum threshold.
 * This indicates the code may have legitimate reasons to deviate from
 * immutability or single-assignment rules.
 */
function checkVariableReassigned(vector: RawFileVector): boolean {
  for (const nt of REASSIGNMENT_NODE_TYPES) {
    if ((vector.nodeTypeCounts[nt] ?? 0) >= REASSIGNMENT_MIN_COUNT) {
      return true;
    }
  }
  return false;
}
