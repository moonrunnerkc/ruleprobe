/**
 * Shared semantic analysis types.
 *
 * These types define the public contract between the ruleprobe CLI client
 * and the ruleprobe-api-service. They are the only semantic types that
 * ship in the public npm package. All proprietary logic lives server-side.
 */

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
  method: 'structural-fast-path' | 'llm-assisted';
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
  apiEndpoint: string;
  licenseKey: string;
  model?: string;
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

/** A rule payload sent to the API service for semantic analysis. */
export interface ExtractedRulePayload {
  ruleId: string;
  ruleText: string;
  qualifier: QualifierType;
  section?: string;
  confidence: number;
}
