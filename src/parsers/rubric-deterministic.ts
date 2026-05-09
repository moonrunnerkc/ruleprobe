/**
 * Deterministic rubric decomposition.
 *
 * Maps known subjective phrases ("write clean code", "keep it simple",
 * "be defensive") to a fixed set of concrete proxy checks that already
 * exist in the verifier engines. Runs without any LLM or network
 * dependency. Rules produced here are tagged
 * extractionMethod = 'rubric-deterministic' with confidence = 'medium'
 * to distinguish them from both the static matcher path (high) and
 * the LLM rubric path (low).
 *
 * The static rubric table lives in rubric-table.ts; this file is the
 * runtime that turns table entries into Rule objects.
 */

import type { Rule } from '../types.js';
import {
  RUBRIC_TABLE,
  type DeterministicRubric,
  type DeterministicRubricCheck,
} from './rubric-table.js';

export type { DeterministicRubric, DeterministicRubricCheck };

/** Severity used by every rubric-derived rule. */
const RUBRIC_SEVERITY: 'warning' = 'warning';

/** Number of hex characters retained from the FNV-1a digest in rule ids. */
const HASH_HEX_LENGTH = 8;
/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;
/** 32-bit modulus mask used to keep arithmetic in unsigned-32-bit range. */
const FNV_MOD = 0x100000000;

/** Output of running the deterministic rubric pass over a list of lines. */
export interface DeterministicRubricResult {
  /** Rules generated from matched phrases. */
  rules: Rule[];
  /** Lines that did not match any rubric phrase. */
  remaining: string[];
}

/**
 * Run deterministic rubric decomposition over a list of unparseable lines.
 *
 * Each line is checked against every rubric's phrase patterns. The
 * first matching rubric expands into one Rule per check, all sharing
 * the same source line and rubric metadata. Lines that match no
 * rubric are returned in `remaining` so the caller can keep them in
 * the unparseable bucket.
 *
 * @param lines - Subjective lines that the static parser could not classify
 * @param existingIds - Existing rule ids; the function will not produce duplicates
 * @returns Generated rules and lines that did not match any rubric
 */
export function runDeterministicRubric(
  lines: string[],
  existingIds: Set<string>,
): DeterministicRubricResult {
  const rules: Rule[] = [];
  const remaining: string[] = [];
  const seenIds = new Set<string>(existingIds);

  for (const line of lines) {
    const matched = matchRubric(line);
    if (!matched) {
      remaining.push(line);
      continue;
    }

    for (const check of matched.checks) {
      const ruleId = buildRuleId(matched.name, check.idSuffix, line);
      if (seenIds.has(ruleId)) {
        continue;
      }
      seenIds.add(ruleId);

      rules.push(buildRule(matched, check, ruleId, line));
    }
  }

  return { rules, remaining };
}

/** Build a single Rule object from a rubric, check, id, and source line. */
function buildRule(
  rubric: DeterministicRubric,
  check: DeterministicRubricCheck,
  ruleId: string,
  sourceLine: string,
): Rule {
  return {
    id: ruleId,
    category: rubric.category,
    source: sourceLine,
    description: `[rubric: ${rubric.name}] ${check.description}`,
    severity: RUBRIC_SEVERITY,
    verifier: check.verifier,
    pattern: { ...check.pattern },
    confidence: 'medium',
    extractionMethod: 'rubric-deterministic',
    rubricWeight: check.weight,
  };
}

/**
 * Find the first rubric whose phrase regex matches the given line.
 *
 * @param line - A subjective instruction line
 * @returns The matching rubric, or undefined when none match
 */
function matchRubric(line: string): DeterministicRubric | undefined {
  for (const rubric of RUBRIC_TABLE) {
    for (const phrase of rubric.phrases) {
      if (phrase.test(line)) {
        return rubric;
      }
    }
  }
  return undefined;
}

/**
 * Build a stable rule id from rubric name, check suffix, and the
 * matched source line. Different lines that activate the same rubric
 * produce different ids so reporters can show per-line evidence.
 */
function buildRuleId(rubricName: string, checkSuffix: string, sourceLine: string): string {
  return `rubric-${rubricName}-${checkSuffix}-${shortHash(sourceLine)}`;
}

/**
 * Tiny non-cryptographic hash used to give rule ids a stable suffix.
 *
 * FNV-1a 32-bit. Cryptographic strength is not needed here; we only
 * want a short, deterministic disambiguator so two different source
 * lines that activate the same rubric do not collide on the same id.
 */
function shortHash(input: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash = (hash ^ input.charCodeAt(i)) >>> 0;
    hash = (hash * FNV_PRIME) % FNV_MOD;
  }
  return hash.toString(16).padStart(HASH_HEX_LENGTH, '0').slice(0, HASH_HEX_LENGTH);
}

/** Read-only view of the rubric table (exposed for tests and tooling). */
export function listRubrics(): readonly DeterministicRubric[] {
  return RUBRIC_TABLE;
}
