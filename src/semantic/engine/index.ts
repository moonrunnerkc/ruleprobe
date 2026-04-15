/**
 * Main entry point for the ruleprobe-semantic package.
 *
 * Exports analyzeSemantic(), the single function the API service calls.
 * Orchestrates: fingerprint generation -> comparison -> LLM escalation
 * -> qualifier resolution -> report assembly.
 */

import type {
  RawExtractionPayload,
  SemanticAnalysisReport,
  SemanticVerdict,
  StructuralProfile,
} from '../types.js';
import { generateFingerprint } from './fingerprint/fingerprint-generator.js';
import { FingerprintCache } from './fingerprint/fingerprint-cache.js';
import { produceCrossFileFindings } from './comparison/cross-file-checker.js';
import { assembleReport } from './comparison/compliance-scorer.js';
import { resolveRule } from './rule-resolver.js';

export type { SemanticAnalysisReport };
export type { LlmCaller } from '../types.js';
export type {
  RawExtractionPayload,
  SemanticVerdict,
  StructuralProfile,
  FeatureVector,
  CrossFileGraph,
  CrossFileFinding,
  ExtractedRulePayload,
  QualifierType,
  QualifierContext,
  RawFileVector,
  PatternTopic,
  StructuralViolation,
} from '../types.js';

/**
 * Pre-calibration fast-path threshold.
 * Will be updated after Phase 4 calibration on real fixtures.
 *
 * Source: ASPE architecture spec.
 */
const DEFAULT_FAST_PATH_THRESHOLD = 0.85;

/**
 * Default maximum LLM calls per analysis run.
 *
 * Source: ASPE architecture spec.
 */
const DEFAULT_MAX_LLM_CALLS = 20;

import type { LlmCaller } from '../types.js';

/** Options controlling semantic analysis behavior. */
export interface AnalyzeOptions {
  /** Fast-path threshold override */
  fastPathThreshold?: number;
  /** Maximum LLM calls */
  maxLlmCalls?: number;
  /** Whether to use profile caching */
  useCache?: boolean;
  /** Cache directory for profiles */
  cacheDir?: string;
}

/**
 * Analyze a codebase's semantic compliance with extracted rules.
 *
 * This is the single entry point the API service calls. It runs
 * the full ASPE pipeline:
 *
 * 1. Generate (or retrieve cached) StructuralProfile
 * 2. For each rule, attempt fast-path via vector similarity
 * 3. Escalate ambiguous rules to LLM
 * 4. Apply qualifier resolution for qualified rules
 * 5. Apply cross-file consistency adjustments
 * 6. Assemble final report
 *
 * @param payload - Raw extraction payload from the client
 * @param llmCaller - Callback for making LLM calls (injected by API service)
 * @param options - Analysis options
 * @returns Complete semantic analysis report
 */
export async function analyzeSemantic(
  payload: RawExtractionPayload,
  llmCaller: LlmCaller,
  options: AnalyzeOptions = {},
): Promise<SemanticAnalysisReport> {
  const threshold = options.fastPathThreshold ?? DEFAULT_FAST_PATH_THRESHOLD;
  const maxLlm = options.maxLlmCalls ?? DEFAULT_MAX_LLM_CALLS;
  const useCache = options.useCache ?? true;

  const { profile, cacheHit } = resolveProfile(payload, useCache, options.cacheDir);

  const topics = Array.from(profile.featureVectors.keys());
  const crossFileFindings = produceCrossFileFindings(
    profile.crossFileGraph,
    payload.fileVectors,
    topics,
  );

  let llmCallCount = 0;
  const verdicts: SemanticVerdict[] = [];

  for (const rule of payload.rules) {
    const result = await resolveRule(
      rule,
      profile,
      payload,
      crossFileFindings,
      threshold,
      llmCaller,
      llmCallCount,
      maxLlm,
    );
    verdicts.push(result.verdict);
    llmCallCount += result.llmCallsUsed;
  }

  return assembleReport(
    verdicts,
    profile,
    cacheHit,
    threshold,
    crossFileFindings,
  );
}

/**
 * Default cache directory for fingerprint profiles.
 */
const DEFAULT_CACHE_DIR = '.ruleprobe-semantic/profiles';

/** Global fingerprint cache instance. */
let globalCache: FingerprintCache | null = null;

/**
 * Get or create the global cache.
 */
function getCache(cacheDir?: string): FingerprintCache {
  const dir = cacheDir ?? DEFAULT_CACHE_DIR;
  if (!globalCache) {
    globalCache = new FingerprintCache(dir);
  }
  return globalCache;
}

/**
 * Resolve a structural profile, using cache when available.
 *
 * @param payload - Raw extraction payload
 * @param useCache - Whether to use caching
 * @param cacheDir - Optional cache directory
 * @returns Profile and cache hit status
 */
function resolveProfile(
  payload: RawExtractionPayload,
  useCache: boolean,
  cacheDir?: string,
): { profile: StructuralProfile; cacheHit: boolean } {
  if (useCache) {
    const cache = getCache(cacheDir);
    const cached = cache.get(payload.extractionHash);
    if (cached) {
      return { profile: cached, cacheHit: true };
    }
  }

  const profile = generateFingerprint(payload);

  if (useCache) {
    const cache = getCache(cacheDir);
    cache.set(payload.extractionHash, profile);
  }

  return { profile, cacheHit: false };
}
