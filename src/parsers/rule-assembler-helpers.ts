/**
 * Rule assembler helper functions and constants.
 *
 * Extracted from rule-assembler.ts for the 300-line file limit.
 * Contains: category mapping, text formatting, and deduplication.
 */

import type { Rule } from '../types.js';
import type { StatementCategory } from './pipeline-types.js';

/**
 * Map statement categories to rule categories and verifier types.
 * All categories are null because generic classification without a
 * concrete matcher implementation produces false-passing rules.
 * Only statements that match a specific deterministic matcher
 * produce verifiable rules. Everything else goes to unparseable.
 */
export const CATEGORY_MAP: Record<StatementCategory, null> = {
  IMPERATIVE_DIRECT: null,
  IMPERATIVE_QUALIFIED: null,
  PREFER_PATTERN: null,
  TOOLING_COMMAND: null,
  FILE_STRUCTURE: null,
  NAMING_CONVENTION: null,
  WORKFLOW: null,
  CODE_STYLE: null,
  PATTERN_REFERENCE: null,
  AGENT_BEHAVIOR: null,
  LANGUAGE_SPECIFIC: null,
  CONTEXT_ONLY: null,
  UNKNOWN: null,
};

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