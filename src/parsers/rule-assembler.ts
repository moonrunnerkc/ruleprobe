/**
 * Pass 3: Rule assembly.
 *
 * Converts classified statements into Rule[] compatible with the v2.0.0
 * pipeline. Only statements that match a concrete deterministic matcher
 * produce verifiable rules. All other statements go to unparseable,
 * preventing false passes from generic rules with no check implementation.
 */

import type { Rule } from '../types.js';
import type { ClassifiedStatement } from './pipeline-types.js';
import { detectQualifier } from './qualifier-detector.js';
import { RULE_MATCHERS } from './rule-patterns.js';
import { EXTENDED_RULE_MATCHERS } from './rule-patterns-extended.js';
import { PROJECT_RULE_MATCHERS } from './rule-patterns-project.js';
import { ADVANCED_RULE_MATCHERS } from './rule-patterns-advanced.js';
import { TREESITTER_RULE_MATCHERS } from './rule-patterns-treesitter.js';
import type { RuleMatcher } from '../types.js';
import {
  truncateDescription,
  stripFormatting,
  deduplicateAssembledRules,
} from './rule-assembler-helpers.js';

/** Combined matcher list for the rule assembly pipeline. */
const ALL_MATCHERS: RuleMatcher[] = [
  ...RULE_MATCHERS,
  ...EXTENDED_RULE_MATCHERS,
  ...PROJECT_RULE_MATCHERS,
  ...ADVANCED_RULE_MATCHERS,
  ...TREESITTER_RULE_MATCHERS,
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

    // No existing matcher: classification-only, not deterministically verifiable.
    // Send to unparseable rather than creating a false-passing generic rule.
    unparseable.push(stmt.text);
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


