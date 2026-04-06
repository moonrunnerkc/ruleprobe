/**
 * All shared types for RuleProbe.
 *
 * These types define the data structures flowing through the core pipeline:
 * instruction file parsing, rule extraction, verification, and reporting.
 */

/** Categories of machine-verifiable rules extracted from instruction files. */
export type RuleCategory =
  | 'naming'
  | 'forbidden-pattern'
  | 'structure'
  | 'test-requirement'
  | 'import-pattern';

/** Which verification engine handles a given rule. */
export type VerifierType = 'ast' | 'regex' | 'filesystem';

/** Instruction file format detected from the file path. */
export type InstructionFileType =
  | 'claude.md'
  | 'agents.md'
  | 'cursorrules'
  | 'copilot-instructions'
  | 'gemini.md'
  | 'windsurfrules'
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
  /** Build the verification pattern from the matched line. */
  buildPattern: (line: string, match: RegExpMatchArray) => VerificationPattern;
}
