/**
 * Types for the RuleProbe-to-ESLint config mapper.
 *
 * These types define the intermediate representation between
 * parsed RuleProbe rules and emitted ESLint config files.
 */

/** Output format for the generated ESLint config. */
export type EslintFormat = 'flat' | 'legacy';

/** Severity level that maps to ESLint rule config values. */
export type EslintSeverity = 'error' | 'warn';

/** A single ESLint rule configuration entry. */
export interface EslintRuleEntry {
  /** The ESLint rule name, e.g. "no-console" or "@typescript-eslint/no-explicit-any". */
  ruleName: string;
  /** The ESLint plugin name if this rule comes from a plugin, e.g. "@typescript-eslint". */
  plugin?: string;
  /** Rule-specific options array (everything after the severity). */
  options?: unknown[];
  /** ESLint severity level. */
  severity: EslintSeverity;
  /** The original RuleProbe rule that was mapped. */
  sourceRuleId: string;
  /** Human-readable description of the original rule. */
  description: string;
}

/** A rule that cannot be mapped to a specific ESLint rule. */
export interface UnmappableRule {
  /** The original RuleProbe rule that couldn't be mapped. */
  sourceRuleId: string;
  /** The original instruction text from the instruction file. */
  sourceText: string;
  /** One-line reason why this rule has no ESLint equivalent. */
  reason: string;
}

/** The complete output of mapping a RuleSet to ESLint config. */
export interface EslintConfig {
  /** All mappable ESLint rule entries. */
  rules: EslintRuleEntry[];
  /** Rules that have no ESLint equivalent. */
  unmappable: UnmappableRule[];
  /** Plugins required by the mapped rules (deduplicated). */
  plugins: string[];
  /** The original instruction file path. */
  sourceFile: string;
}

/** A mapping function that takes a RuleProbe pattern type and returns ESLint config. */
export interface RuleMapping {
  /** The RuleProbe pattern type(s) this mapping handles. */
  patternTypes: string[];
  /** Map a pattern's details to an ESLint rule entry, or return null if unmappable. */
  map: (pattern: { type: string; target: string; expected: string | boolean; scope: string }) => EslintRuleEntry | null;
}