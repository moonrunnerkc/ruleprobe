/**
 * Core type primitives for RuleProbe.
 *
 * These types describe instruction files, the rules extracted from
 * them, and the matchers that drive extraction. Result and report
 * types live in types-results.ts so that adding a new result field
 * does not push the file past the 300-line self-check limit.
 *
 * Re-exported by types.ts; prefer importing from '../types.js' in
 * most call sites so callers see a single surface.
 */

/** Categories of machine-verifiable rules extracted from instruction files. */
export type RuleCategory =
  | 'naming'
  | 'forbidden-pattern'
  | 'structure'
  | 'import-pattern'
  | 'error-handling'
  | 'type-safety'
  | 'code-style'
  | 'agent-behavior';

/** Which verification engine handles a given rule. */
export type VerifierType = 'ast' | 'regex' | 'filesystem' | 'treesitter';

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
  extractionMethod?: 'static' | 'llm' | 'rubric' | 'rubric-deterministic' | 'custom';
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
