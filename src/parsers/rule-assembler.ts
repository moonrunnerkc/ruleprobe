/**
 * Pass 3: Rule assembly.
 *
 * Converts classified statements into Rule[] compatible with the v2.0.0
 * pipeline. Rules that are classifiable but not matchable to existing
 * matchers (WORKFLOW, CODE_STYLE, PATTERN_REFERENCE) are still extracted
 * with appropriate category and verifier. Deterministic matchers skip them.
 *
 * Also attempts to match against the existing 82 matchers for backwards
 * compatibility: if a statement matches a specific matcher, prefer that
 * over the generic classification.
 */

import type { Rule, RuleCategory, VerifierType } from '../types.js';
import type { ClassifiedStatement } from './pipeline-types.js';
import { detectQualifier } from './qualifier-detector.js';
import { RULE_MATCHERS } from './rule-patterns.js';
import { EXTENDED_RULE_MATCHERS } from './rule-patterns-extended.js';
import { PROJECT_RULE_MATCHERS } from './rule-patterns-project.js';
import { ADVANCED_RULE_MATCHERS } from './rule-patterns-advanced.js';
import { PREFERENCE_MATCHERS } from './rule-patterns-preference.js';
import { FILE_STRUCTURE_MATCHERS } from './rule-patterns-file-structure.js';
import { TOOLING_MATCHERS } from './rule-patterns-tooling.js';
import { TESTING_MATCHERS } from './rule-patterns-testing.js';
import { CONFIG_FILE_MATCHERS } from './rule-patterns-config-file.js';
import { GIT_HISTORY_MATCHERS } from './rule-patterns-git-history.js';
import type { RuleMatcher } from '../types.js';
import {
  CATEGORY_MAP,
  categoryToIdPrefix,
  buildGenericPattern,
  truncateDescription,
  stripFormatting,
  deduplicateAssembledRules,
} from './rule-assembler-helpers.js';

/** Combined matcher list from the existing v2.0.0 pipeline. */
const ALL_MATCHERS: RuleMatcher[] = [
  ...RULE_MATCHERS,
  ...EXTENDED_RULE_MATCHERS,
  ...PROJECT_RULE_MATCHERS,
  ...ADVANCED_RULE_MATCHERS,
  ...PREFERENCE_MATCHERS,
  ...FILE_STRUCTURE_MATCHERS,
  ...TOOLING_MATCHERS,
  ...TESTING_MATCHERS,
  ...CONFIG_FILE_MATCHERS,
  ...GIT_HISTORY_MATCHERS,
];

/** Counter for generating unique rule IDs. */
let assemblerCounter = 0;

/**
 * Reset the internal rule ID counter.
 * Call between test runs for deterministic IDs.
 */
export function resetAssemblerCounter(): void {
  assemblerCounter = 0;
}

/**
 * Assemble classified statements into Rule[].
 *
 * For each actionable statement, first attempts to match against the
 * existing 82 matchers. If a match is found, produces a precise Rule.
 * If no matcher matches, produces a generic Rule from the classification.
 *
 * @param statements - Classified statements from Pass 2
 * @returns Object with assembled rules and unclassified/context statements
 */
export function assembleRules(statements: ClassifiedStatement[]): {
  rules: Rule[];
  unparseable: string[];
  contextOnly: string[];
  unclassified: string[];
} {
  const rules: Rule[] = [];
  const unparseable: string[] = [];
  const contextOnly: string[] = [];
  const unclassified: string[] = [];
  const seenMatcherIds = new Set<string>();

  for (const stmt of statements) {
    // Skip context-only
    if (stmt.category === 'CONTEXT_ONLY') {
      contextOnly.push(stmt.text);
      continue;
    }

    // UNKNOWN goes to unclassified only if no existing matcher catches it
    if (stmt.category === 'UNKNOWN') {
      const matcherRules = tryMatchExisting(
        stmt.text,
        stmt.sectionHeader,
        seenMatcherIds,
      );
      if (matcherRules.length > 0) {
        rules.push(...matcherRules);
      } else {
        unclassified.push(stmt.text);
      }
      continue;
    }

    // Try matching against existing matchers first
    const matcherRules = tryMatchExisting(
      stmt.text,
      stmt.sectionHeader,
      seenMatcherIds,
    );
    if (matcherRules.length > 0) {
      rules.push(...matcherRules);
      continue;
    }

    // No existing matcher: build a generic rule from classification
    const mapping = CATEGORY_MAP[stmt.category];
    if (!mapping) {
      // Non-verifiable category (WORKFLOW, PATTERN_REFERENCE)
      // Still extract as a rule but mark as not verifiable
      const rule = buildGenericRule(stmt);
      if (rule) {
        rules.push(rule);
      } else {
        unparseable.push(stmt.text);
      }
      continue;
    }

    const rule = buildClassifiedRule(stmt, mapping);
    rules.push(rule);
  }

  return {
    rules: deduplicateAssembledRules(rules),
    unparseable,
    contextOnly,
    unclassified,
  };
}

/**
 * Try to match a statement against the existing 82 v2.0.0 matchers.
 * Returns ALL matching rules (a single line can express multiple rules).
 *
 * @returns Array of matched Rules (empty if no matcher applies)
 */
function tryMatchExisting(
  text: string,
  sectionHeader: string,
  seenMatcherIds: Set<string>,
): Rule[] {
  const stripped = stripFormatting(text);
  const qualifier = detectQualifier(stripped);
  const matched: Rule[] = [];

  for (const matcher of ALL_MATCHERS) {
    if (seenMatcherIds.has(matcher.id)) {
      continue;
    }
    for (const pattern of matcher.patterns) {
      const match = stripped.match(pattern);
      if (match) {
        assemblerCounter++;
        seenMatcherIds.add(matcher.id);
        matched.push({
          id: `${matcher.id}-${assemblerCounter}`,
          category: matcher.category,
          source: text,
          description: matcher.description,
          severity: matcher.severity,
          verifier: matcher.verifier,
          pattern: matcher.buildPattern(stripped, match),
          confidence: matcher.confidence ?? 'high',
          extractionMethod: 'static',
          section: sectionHeader || undefined,
          qualifier,
        });
        break;
      }
    }
  }
  return matched;
}

/**
 * Build a rule from a classified statement that matched no existing matcher.
 */
function buildClassifiedRule(
  stmt: ClassifiedStatement,
  mapping: { ruleCategory: RuleCategory; verifier: VerifierType; severity: 'error' | 'warning' },
): Rule {
  assemblerCounter++;
  const qualifier = detectQualifier(stmt.text);
  const confidenceLevel = stmt.confidence >= 0.9 ? 'high'
    : stmt.confidence >= 0.7 ? 'medium'
      : 'low';

  return {
    id: `${categoryToIdPrefix(stmt.category)}-${assemblerCounter}`,
    category: mapping.ruleCategory,
    source: stmt.text,
    description: truncateDescription(stmt.text),
    severity: mapping.severity,
    verifier: mapping.verifier,
    pattern: buildGenericPattern(stmt),
    confidence: confidenceLevel,
    extractionMethod: 'static',
    section: stmt.sectionHeader || undefined,
    qualifier,
  };
}

/**
 * Build a rule for non-verifiable categories (AGENT_BEHAVIOR, PATTERN_REFERENCE).
 * These are extracted but flagged as not currently verifiable by code tools.
 */
function buildGenericRule(stmt: ClassifiedStatement): Rule | null {
  assemblerCounter++;
  const qualifier = detectQualifier(stmt.text);

  // Map non-verifiable categories to the closest rule category
  const categoryMap: Record<string, RuleCategory> = {
    AGENT_BEHAVIOR: 'agent-behavior',
    PATTERN_REFERENCE: 'code-style',
  };

  const ruleCategory = categoryMap[stmt.category];
  if (!ruleCategory) {
    return null;
  }

  return {
    id: `${categoryToIdPrefix(stmt.category)}-${assemblerCounter}`,
    category: ruleCategory,
    source: stmt.text,
    description: truncateDescription(stmt.text),
    severity: 'warning',
    verifier: 'regex',
    pattern: {
      type: stmt.category.toLowerCase().replace(/_/g, '-'),
      target: 'project',
      expected: stmt.text,
      scope: 'project',
    },
    confidence: stmt.confidence >= 0.7 ? 'medium' : 'low',
    extractionMethod: 'static',
    section: stmt.sectionHeader || undefined,
    qualifier,
  };
}
