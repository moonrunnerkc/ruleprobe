/**
 * Rule assembler helper functions and constants.
 *
 * Extracted from rule-assembler.ts for the 300-line file limit.
 * Contains: category mapping, ID prefix generation, pattern building,
 * text formatting, and deduplication.
 */

import type { Rule, RuleCategory, VerifierType, VerificationPattern } from '../types.js';
import type { StatementCategory, ClassifiedStatement } from './pipeline-types.js';

/**
 * Map statement categories to rule categories and verifier types.
 * Categories not in this map are not directly verifiable.
 */
export const CATEGORY_MAP: Record<StatementCategory, {
  ruleCategory: RuleCategory;
  verifier: VerifierType;
  severity: 'error' | 'warning';
} | null> = {
  IMPERATIVE_DIRECT: {
    ruleCategory: 'code-style',
    verifier: 'regex',
    severity: 'error',
  },
  IMPERATIVE_QUALIFIED: {
    ruleCategory: 'code-style',
    verifier: 'regex',
    severity: 'warning',
  },
  PREFER_PATTERN: {
    ruleCategory: 'preference',
    verifier: 'preference',
    severity: 'warning',
  },
  TOOLING_COMMAND: {
    ruleCategory: 'tooling',
    verifier: 'tooling',
    severity: 'warning',
  },
  FILE_STRUCTURE: {
    ruleCategory: 'file-structure',
    verifier: 'filesystem',
    severity: 'warning',
  },
  NAMING_CONVENTION: {
    ruleCategory: 'naming',
    verifier: 'ast',
    severity: 'error',
  },
  WORKFLOW: {
    ruleCategory: 'workflow',
    verifier: 'config-file',
    severity: 'warning',
  },
  CODE_STYLE: {
    ruleCategory: 'code-style',
    verifier: 'regex',
    severity: 'warning',
  },
  PATTERN_REFERENCE: null,
  AGENT_BEHAVIOR: null,
  LANGUAGE_SPECIFIC: {
    ruleCategory: 'code-style',
    verifier: 'ast',
    severity: 'warning',
  },
  CONTEXT_ONLY: null,
  UNKNOWN: null,
};

/**
 * Map a statement category to a rule ID prefix.
 *
 * @param category - The statement category
 * @returns A kebab-case prefix for rule IDs
 */
export function categoryToIdPrefix(category: StatementCategory): string {
  const prefixes: Record<StatementCategory, string> = {
    IMPERATIVE_DIRECT: 'imperative',
    IMPERATIVE_QUALIFIED: 'qualified',
    PREFER_PATTERN: 'prefer',
    TOOLING_COMMAND: 'tooling-cmd',
    FILE_STRUCTURE: 'file-struct',
    NAMING_CONVENTION: 'naming-conv',
    WORKFLOW: 'workflow',
    CODE_STYLE: 'code-style',
    PATTERN_REFERENCE: 'pattern-ref',
    AGENT_BEHAVIOR: 'agent-behavior',
    LANGUAGE_SPECIFIC: 'lang-specific',
    CONTEXT_ONLY: 'context',
    UNKNOWN: 'unknown',
  };
  return prefixes[category] ?? 'unknown';
}

/**
 * Build a generic verification pattern from a classified statement.
 *
 * @param stmt - The classified statement
 * @returns A verification pattern with category-based type
 */
export function buildGenericPattern(stmt: ClassifiedStatement): VerificationPattern {
  return {
    type: stmt.category.toLowerCase().replace(/_/g, '-'),
    target: 'project',
    expected: stmt.text,
    scope: 'project',
  };
}

/**
 * Truncate description to a reasonable length.
 *
 * @param text - The full rule text
 * @returns Cleaned and truncated description
 */
export function truncateDescription(text: string): string {
  /** Maximum characters for a rule description. */
  const MAX_DESCRIPTION_LENGTH = 120;
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
  if (clean.length <= MAX_DESCRIPTION_LENGTH) {
    return clean;
  }
  return clean.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
}

/**
 * Strip markdown formatting for matcher comparison.
 *
 * @param line - Raw line text
 * @returns Stripped text suitable for pattern matching
 */
export function stripFormatting(line: string): string {
  return line
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Deduplicate rules by their matcher ID prefix.
 * When the same matcher matched multiple statements, keep first.
 *
 * @param rules - Array of rules that may have duplicates
 * @returns Deduplicated rules array
 */
export function deduplicateAssembledRules(rules: Rule[]): Rule[] {
  const seen = new Set<string>();
  const result: Rule[] = [];

  for (const rule of rules) {
    const prefix = rule.id.replace(/-\d+$/, '');
    if (!seen.has(prefix)) {
      seen.add(prefix);
      result.push(rule);
    }
  }

  return result;
}
