/**
 * Types for the drift detection module.
 *
 * Drift detection compares the ESLint config derived from a CLAUDE.md
 * instruction file against an existing ESLint config file, reporting
 * mismatches in both directions.
 */

import type { EslintSeverity } from '../mapper/types.js';

/** A normalized ESLint rule entry parsed from a config file. */
export interface ParsedEslintRule {
  /** The rule name, e.g. "no-console" or "@typescript-eslint/no-explicit-any". */
  ruleName: string;
  /** Severity level as found in the config file. "off" means the rule is disabled. */
  severity: 'error' | 'warn' | 'off';
  /** Rule-specific options (everything after the severity entry). */
  options: unknown[];
}

/** A parsed ESLint config file, ready for comparison. */
export interface ParsedEslintConfig {
  /** All rule entries found in the config. */
  rules: ParsedEslintRule[];
  /** Path to the source config file. */
  sourceFile: string;
}

/** The kind of drift between two configs. */
export type DriftKind =
  | 'md-only'
  | 'eslint-only'
  | 'severity-mismatch'
  | 'config-arg-mismatch';

/** A single drift item describing a mismatch. */
export interface DriftItem {
  kind: DriftKind;
  /** The ESLint rule name where the drift was found. */
  ruleName: string;
  /** The RuleProbe rule ID (for md-only items). */
  mdRuleId?: string;
  /** Description from the CLAUDE.md mapping (for md-only items). */
  mdDescription?: string;
  /** Severity from the CLAUDE.md mapping (for severity/config mismatches). */
  mdSeverity?: EslintSeverity;
  /** Severity from the ESLint config file (for severity/config mismatches). */
  eslintSeverity?: 'error' | 'warn' | 'off';
  /** Options from the CLAUDE.md mapping (for config-arg mismatches). */
  mdOptions?: unknown[];
  /** Options from the ESLint config file (for config-arg mismatches). */
  eslintOptions?: unknown[];
  /** Human-readable explanation of the drift. */
  message: string;
}

/** The result of comparing a CLAUDE.md mapping against an ESLint config. */
export interface DriftResult {
  /** All drift items found. */
  items: DriftItem[];
  /** The CLAUDE.md source file path. */
  mdFile: string;
  /** The ESLint config source file path. */
  eslintFile: string;
  /** Whether any drift was detected. */
  hasDrift: boolean;
}

/** Output format for drift reports. */
export type DriftFormat = 'text' | 'json' | 'markdown';