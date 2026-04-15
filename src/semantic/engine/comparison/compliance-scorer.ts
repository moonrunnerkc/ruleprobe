/**
 * Final compliance score assembly.
 *
 * Combines fast-path resolution, LLM verdicts, cross-file
 * adjustments, and qualifier context into the final
 * SemanticAnalysisReport.
 */

import type {
  SemanticVerdict,
  SemanticAnalysisReport,
  StructuralProfile,
  CrossFileFinding,
} from '../../types.js';

/**
 * Assemble a complete SemanticAnalysisReport from verdicts and metadata.
 *
 * @param verdicts - All resolved verdicts
 * @param profile - The structural profile used for analysis
 * @param profileCacheHit - Whether the profile was served from cache
 * @param fastPathThreshold - The threshold used for fast-path decisions
 * @param crossFileFindings - Cross-file consistency findings
 * @returns A complete analysis report
 */
export function assembleReport(
  verdicts: SemanticVerdict[],
  profile: StructuralProfile,
  profileCacheHit: boolean,
  fastPathThreshold: number,
  crossFileFindings: CrossFileFinding[],
): SemanticAnalysisReport {
  let fastPathResolutions = 0;
  let llmResolutions = 0;
  let unresolvedRules = 0;
  let totalTokenCost = 0;

  for (const verdict of verdicts) {
    if (verdict.method === 'not-verifiable' || verdict.method === 'topic-matched-no-profile') {
      unresolvedRules += 1;
    } else if (verdict.method === 'structural-fast-path') {
      fastPathResolutions += 1;
    } else {
      llmResolutions += 1;
    }
    totalTokenCost += verdict.tokenCost;
  }

  /** Only count rules that were actually resolved (not unverifiable). */
  const resolvedCount = verdicts.length - unresolvedRules;

  return {
    rulesAnalyzed: resolvedCount,
    fastPathResolutions,
    llmResolutions,
    unresolvedRules,
    totalTokenCost,
    verdicts,
    profile,
    profileCacheHit,
    fastPathThreshold,
    crossFileFindings,
  };
}
