/**
 * Shared semantic analysis types.
 *
 * These types define the contract between the ruleprobe CLI and the
 * semantic analysis engine. All analysis runs locally.
 */

export type { QualifierType } from '../types.js';
import type { QualifierType } from '../types.js';

/** A pattern topic identifier used to classify codebase patterns. */
export type PatternTopic = string;

/** Structural profile of a codebase, built from raw AST vectors. */
export interface StructuralProfile {
  /** Content hash of every file that contributed to this profile */
  profileId: string;
  /** When this profile was generated */
  generatedAt: string;
  /** Feature vectors keyed by pattern topic */
  featureVectors: Map<PatternTopic, FeatureVector>;
  /** Sparse cross-file pattern graph (only topics referenced in rules) */
  crossFileGraph: CrossFileGraph;
  /** Total files scanned */
  sampleSize: number;
}

/** Feature vector for a single pattern topic within a codebase profile. */
export interface FeatureVector {
  /** Normalized AST node type counts */
  nodeTypeCounts: Record<string, number>;
  /** Average nesting depths for relevant patterns */
  nestingDepths: Record<string, number>;
  /** Canonical AST sub-tree hashes distinguishing structurally different approaches */
  patternSignatures: string[];
  /** Prevalence of this topic in the codebase (0-1) */
  prevalence: number;
  /**
   * Multi-node conjunction counts.
   *
   * Each key is a composite pattern name (e.g. "try-catch-with-logging");
   * the value is the normalized per-file count of files exhibiting that
   * conjunction. Captures structural co-occurrences that individual node
   * counts miss.
   */
  compositePatterns: Record<string, number>;
}

/** Sparse cross-file pattern graph tracking which files share structural patterns. */
export interface CrossFileGraph {
  /** Sparse adjacency: file identifier -> pattern signature -> list of peer file identifiers */
  edges: Map<string, Map<string, string[]>>;
}

/** Verdict from semantic analysis of a single rule. */
export interface SemanticVerdict {
  ruleId: string;
  compliance: number;
  method: 'structural-fast-path' | 'llm-assisted' | 'not-verifiable' | 'topic-matched-no-profile';
  reasoning?: string;
  violations: StructuralViolation[];
  mitigations: string[];
  profileHash: string;
  tokenCost: number;
}

/** A structural violation: a mismatch between rule expectation and codebase pattern. */
export interface StructuralViolation {
  feature: string;
  location: string;
  expected: string;
  found: string;
}

/** Configuration for semantic analysis, resolved from CLI flags, env vars, and config file. */
export interface SemanticAnalysisConfig {
  anthropicApiKey: string;
  maxLlmCalls?: number;
  useCache?: boolean;
  fastPathThreshold?: number;
}

/**
 * Contextual flags computed from raw vectors to determine
 * whether a qualified rule deviation is justified.
 */
export interface QualifierContext {
  inTightLoop: boolean;
  thirdPartyBoundary: boolean;
  deviationCommentPresent: boolean;
  frameworkConstraintDetected: boolean;
  legacyCodeRegion: boolean;
  testCode: boolean;
  /**
   * Whether the file contains variable reassignments
   * (assignment_expression or update_expression).
   *
   * Justifies using `let` over `const` or mutable state patterns
   * when the variable is genuinely reassigned.
   */
  variableReassigned: boolean;
}

/** Complete report from a semantic analysis run. */
export interface SemanticAnalysisReport {
  rulesAnalyzed: number;
  fastPathResolutions: number;
  llmResolutions: number;
  unresolvedRules: number;
  totalTokenCost: number;
  verdicts: SemanticVerdict[];
  profile: StructuralProfile;
  profileCacheHit: boolean;
  fastPathThreshold: number;
  crossFileFindings: CrossFileFinding[];
}

/** A finding about cross-file pattern consistency within a topic. */
export interface CrossFileFinding {
  topic: PatternTopic;
  consistentFiles: string[];
  deviatingFiles: string[];
  signatureHash: string;
}

/** Raw extraction payload sent from the CLI client to the API service. */
export interface RawExtractionPayload {
  /** Per-file raw vectors (keyed by opaque file identifier, NOT file path) */
  fileVectors: Record<string, RawFileVector>;
  /** Extracted rules from instruction files */
  rules: ExtractedRulePayload[];
  /** Content hash of the entire extraction for caching */
  extractionHash: string;
}

/** Raw AST vector data for a single file. */
export interface RawFileVector {
  /** AST node type counts for this file */
  nodeTypeCounts: Record<string, number>;
  /** Nesting depth measurements */
  nestingDepths: Record<string, number>;
  /** Opaque AST sub-tree hashes */
  subTreeHashes: string[];
}

/** A rule payload sent for semantic analysis. */
export interface ExtractedRulePayload {
  ruleId: string;
  ruleText: string;
  qualifier: QualifierType;
  section?: string;
  confidence: number;
}

/**
 * Callback type for making LLM calls.
 * The Anthropic caller is injected through this interface.
 */
export type LlmCaller = (
  model: string,
  prompt: string,
) => Promise<string>;
