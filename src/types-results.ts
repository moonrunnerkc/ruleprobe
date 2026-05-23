/**
 * Result, report, and project-analysis types for RuleProbe.
 *
 * Built on the primitives in types-core.ts. Split from types.ts to
 * keep both files under the 300-line self-check limit. Re-exported
 * by types.ts; prefer importing from '../types.js' in most call
 * sites so callers see a single surface.
 */

import type {
  Rule,
  RuleCategory,
  RuleSet,
  InstructionFileType,
} from './types-core.js';

/** Valid output format for adherence reports. */
export type ReportFormat = 'text' | 'json' | 'markdown' | 'rdjson' | 'summary' | 'detailed' | 'ci';

/** A standardized coding task designed to exercise rule categories. */
export interface TaskTemplate {
  /** Unique identifier, e.g. "rest-endpoint". */
  id: string;
  /** Human-readable name, e.g. "REST API Endpoint". */
  name: string;
  /** The full prompt given to the coding agent. */
  prompt: string;
  /** Files the agent output should contain. */
  expectedFiles: string[];
  /** Which rule categories this task exercises. */
  exercises: RuleCategory[];
}

/** Metadata about a single agent run. */
export interface AgentRun {
  /** Agent identifier, e.g. "claude-code", "copilot", "cursor". */
  agent: string;
  /** Model version, e.g. "opus-4.6". */
  model: string;
  /** Which task template was given to the agent. */
  taskTemplateId: string;
  /** Path to the directory containing agent output files. */
  outputDir: string;
  /** ISO 8601 timestamp of when the run started. */
  timestamp: string;
  /** How long the agent took, or null if not measured. */
  durationSeconds: number | null;
}

/** A piece of evidence supporting a rule result (pass or fail). */
export interface Evidence {
  /** The file where the check was performed. */
  file: string;
  /** Line number of the finding, or null for file-level checks. */
  line: number | null;
  /** What was actually found in the code. */
  found: string;
  /** What the rule required. */
  expected: string;
  /** Surrounding code for readability. */
  context: string;
}

/** The result of checking a single rule against agent output. */
export interface RuleResult {
  /** The rule that was checked. */
  rule: Rule;
  /** Whether the agent output conformed to this rule. */
  passed: boolean;
  /** Compliance ratio from 0 to 1. Binary checks return 0 or 1. Pattern checks return the ratio. */
  compliance: number;
  /** Evidence of what was checked and found. */
  evidence: Evidence[];
  /** Whether this rule was skipped because it has no concrete implementation. */
  skipped?: boolean;
}

/** Per-category breakdown of pass/total counts. */
export interface CategoryScore {
  passed: number;
  total: number;
}

/** Summary statistics for an adherence report. */
export interface ReportSummary {
  /** Total number of rules checked. */
  totalRules: number;
  /** Number of rules that passed. */
  passed: number;
  /** Number of rules that failed. */
  failed: number;
  /** Number of rules skipped (present in ruleset but excluded from verification, e.g. by severity filter). */
  skipped: number;
  /** Number of warnings (failed rules with severity "warning"). */
  warnings: number;
  /** Adherence score as a percentage (passed / totalRules * 100). */
  adherenceScore: number;
  /** Pass/total breakdown by rule category. */
  byCategory: Record<RuleCategory, CategoryScore>;
}

/** A complete adherence report for a single agent run. */
export interface AdherenceReport {
  /** Metadata about the agent run. */
  run: AgentRun;
  /** The rules that were checked. */
  ruleset: RuleSet;
  /** Individual results for each rule. */
  results: RuleResult[];
  /** Aggregate summary. */
  summary: ReportSummary;
}

/** A conflict between rules in different instruction files. */
export interface CrossFileConflict {
  /** Topic or pattern category the conflict relates to. */
  topic: string;
  /** Rules from different files that contradict each other. */
  rules: Array<{ file: string; rule: Rule }>;
  /** Description of the conflict. */
  description: string;
}

/** A redundancy: the same instruction appearing in multiple files. */
export interface CrossFileRedundancy {
  /** Normalized text of the redundant instruction. */
  normalizedText: string;
  /** Occurrences across files. */
  occurrences: Array<{ file: string; originalText: string }>;
}

/** Per-file analysis result within a project. */
export interface FileAnalysis {
  /** Path to the instruction file. */
  filePath: string;
  /** Detected file format. */
  fileType: InstructionFileType;
  /** Rules extracted from this file. */
  ruleSet: RuleSet;
  /** Verification results (populated after verification). */
  results: RuleResult[];
}

/** Complete project-level analysis across all instruction files. */
export interface ProjectAnalysis {
  /** Root directory of the project. */
  projectDir: string;
  /** Per-file analysis results. */
  files: FileAnalysis[];
  /** Cross-file conflicts (same topic, different instructions). */
  conflicts: CrossFileConflict[];
  /** Cross-file redundancies (same instruction, different wording). */
  redundancies: CrossFileRedundancy[];
  /** Map of rule categories to which files contain rules in that category. */
  coverageMap: Record<string, string[]>;
  /** Aggregate summary across all files. */
  summary: ReportSummary;
}

/** Default compliance threshold for determining pass/fail from compliance ratios. */
export const DEFAULT_COMPLIANCE_THRESHOLD = 0.8;
