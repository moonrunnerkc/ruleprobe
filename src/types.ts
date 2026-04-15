/**
 * All shared types for RuleProbe.
 *
 * These types define the data structures flowing through the core pipeline:
 * instruction file parsing, rule extraction, verification, and reporting.
 */

/** Valid output format for adherence reports. */
export type ReportFormat = 'text' | 'json' | 'markdown' | 'rdjson' | 'summary' | 'detailed' | 'ci';

/** Categories of machine-verifiable rules extracted from instruction files. */
export type RuleCategory =
  | 'naming'
  | 'forbidden-pattern'
  | 'structure'
  | 'test-requirement'
  | 'import-pattern'
  | 'error-handling'
  | 'type-safety'
  | 'code-style'
  | 'dependency'
  | 'preference'
  | 'file-structure'
  | 'tooling'
  | 'testing'
  | 'workflow'
  | 'agent-behavior';

/** Which verification engine handles a given rule. */
export type VerifierType = 'ast' | 'regex' | 'filesystem' | 'treesitter' | 'preference' | 'tooling' | 'config-file' | 'git-history';

/**
 * Qualifier describing the strength of an instruction.
 *
 * Detected via deterministic keyword/phrase matching on the rule text
 * during extraction. Rules with no qualifier keyword default to 'always'.
 */
export type QualifierType =
  | 'always'
  | 'prefer'
  | 'when-possible'
  | 'avoid-unless'
  | 'try-to'
  | 'never';

/** Instruction file format detected from the file path. */
export type InstructionFileType =
  | 'claude.md'
  | 'agents.md'
  | 'cursorrules'
  | 'copilot-instructions'
  | 'gemini.md'
  | 'windsurfrules'
  | 'rules'
  | 'generic-markdown'
  | 'unknown';

/** Describes the specific check a verifier runs for a rule. */
export interface VerificationPattern {
  /** The kind of check, e.g. "camelCase", "no-any", "file-exists". */
  type: string;
  /** What to check, e.g. "variables", "*.ts", "src/". */
  target: string;
  /** The expected value, pattern, or boolean condition. */
  expected: string | boolean;
  /** Whether the check applies per-file or across the whole project. */
  scope: 'file' | 'project';
}

/** A single machine-verifiable rule extracted from an instruction file. */
export interface Rule {
  /** Unique identifier, e.g. "naming-camelcase-variables". */
  id: string;
  /** Which category this rule belongs to. */
  category: RuleCategory;
  /** The raw text from the instruction file that produced this rule. */
  source: string;
  /** Human-readable summary of what the rule checks. */
  description: string;
  /** Whether a violation is an error or a warning. */
  severity: 'error' | 'warning';
  /** Which verification engine handles this rule. */
  verifier: VerifierType;
  /** The specific check to run. */
  pattern: VerificationPattern;
  /** Confidence level of the extraction (high = exact keyword match). */
  confidence?: 'high' | 'medium' | 'low';
  /** How this rule was extracted. */
  extractionMethod?: 'static' | 'llm' | 'rubric' | 'custom';
  /** Weight within a rubric (0-1). Only set for rubric-decomposed rules. */
  rubricWeight?: number;
  /** The markdown section header this rule was found under. */
  section?: string;
  /** Qualifier strength detected from the instruction text. */
  qualifier?: QualifierType;
}

/** A complete set of rules extracted from a single instruction file. */
export interface RuleSet {
  /** Path to the instruction file that was parsed. */
  sourceFile: string;
  /** Detected file format. */
  sourceType: InstructionFileType;
  /** All machine-verifiable rules that were extracted. */
  rules: Rule[];
  /** Lines from the instruction file that could not be converted to rules. */
  unparseable: string[];
}

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

/** A parsed section from a markdown instruction file. */
export interface MarkdownSection {
  /** The header text (without leading # characters). */
  header: string;
  /** Header depth (1 for #, 2 for ##, etc). */
  depth: number;
  /** The body content under this header, as raw text. */
  body: string;
  /** Lines within the body, trimmed and filtered for empties. */
  lines: string[];
}

/**
 * A matcher definition that maps natural language patterns in instruction
 * files to structured, machine-verifiable rules.
 */
export interface RuleMatcher {
  /** Unique identifier prefix for rules produced by this matcher. */
  id: string;
  /** Regex patterns that match instruction lines this rule covers. */
  patterns: RegExp[];
  /** The rule category. */
  category: RuleCategory;
  /** Which verifier handles this rule. */
  verifier: VerifierType;
  /** Human-readable description of what this rule checks. */
  description: string;
  /** Default severity. */
  severity: 'error' | 'warning';
  /** Confidence level for rules produced by this matcher. */
  confidence?: 'high' | 'medium' | 'low';
  /** Build the verification pattern from the matched line. */
  buildPattern: (line: string, match: RegExpMatchArray) => VerificationPattern;
}

/**
 * Recognized instruction file names.
 * Used by project-level discovery to find all instruction files in a repo.
 */
export const INSTRUCTION_FILE_NAMES = [
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
  'GEMINI.md',
  '.windsurfrules',
  '.rules',
] as const;

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
