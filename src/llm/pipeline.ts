/**
 * LLM extraction pipeline.
 *
 * Takes unparseable lines from static extraction and runs them
 * through an LLM provider to extract additional rules. Results
 * are merged back into the RuleSet with extractionMethod 'llm'.
 */

import type { Rule, RuleSet } from '../types.js';
import type { LlmExtractOptions, LlmRuleCandidate } from './types.js';
import { KNOWN_PATTERN_TYPES } from './known-patterns.js';

/**
 * Run LLM extraction on a RuleSet's unparseable lines.
 *
 * Sends unparseable lines to the configured LLM provider, converts
 * valid responses to Rule objects, and returns a new RuleSet with
 * LLM-extracted rules appended and remaining lines updated.
 *
 * Does not mutate the input RuleSet.
 *
 * @param ruleSet - The RuleSet from static extraction
 * @param options - LLM provider and extraction options
 * @returns New RuleSet with LLM-extracted rules merged in
 */
export async function extractWithLlm(
  ruleSet: RuleSet,
  options: LlmExtractOptions,
): Promise<RuleSet> {
  const { provider, batchSize = 50 } = options;

  if (ruleSet.unparseable.length === 0) {
    return ruleSet;
  }

  const lines = ruleSet.unparseable.slice(0, batchSize);
  const result = await provider.extractRules(lines, KNOWN_PATTERN_TYPES);

  const existingIds = new Set(ruleSet.rules.map((r) => r.id.replace(/-\d+$/, '')));
  const newRules: Rule[] = [];

  for (const candidate of result.candidates) {
    const ruleId = `llm-${candidate.id}`;
    if (existingIds.has(ruleId)) {
      continue;
    }
    existingIds.add(ruleId);

    newRules.push(candidateToRule(candidate, lines));
  }

  const remainingUnparseable = [
    ...result.remaining,
    ...ruleSet.unparseable.slice(batchSize),
  ];

  return {
    ...ruleSet,
    rules: [...ruleSet.rules, ...newRules],
    unparseable: remainingUnparseable,
  };
}

/**
 * Convert an LLM candidate to a full Rule object.
 */
function candidateToRule(candidate: LlmRuleCandidate, sourceLines: string[]): Rule {
  return {
    id: `llm-${candidate.id}`,
    category: candidate.category,
    source: sourceLines.find((l) => l.includes(candidate.id)) ?? 'LLM extraction',
    description: candidate.description,
    severity: 'warning',
    verifier: candidate.verifier,
    pattern: {
      type: candidate.patternType,
      target: candidate.target,
      expected: candidate.expected,
      scope: candidate.scope,
    },
    confidence: 'medium',
    extractionMethod: 'llm',
  };
}
