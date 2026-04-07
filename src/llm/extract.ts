/**
 * Core LLM extraction logic: prompt construction and response parsing.
 *
 * Builds a structured prompt that instructs the LLM to map unparseable
 * instruction lines to known verification pattern types. Parses the
 * JSON response and validates each candidate.
 */

import type { LlmRuleCandidate, LlmExtractionResult } from './types.js';
import type { RuleCategory, VerifierType } from '../types.js';

/** Valid categories for LLM-extracted rules. */
const VALID_CATEGORIES: ReadonlySet<string> = new Set<RuleCategory>([
  'naming', 'forbidden-pattern', 'structure', 'test-requirement',
  'import-pattern', 'error-handling', 'type-safety', 'code-style', 'dependency',
]);

/** Valid verifier types. */
const VALID_VERIFIERS: ReadonlySet<string> = new Set<VerifierType>([
  'ast', 'regex', 'filesystem',
]);

/** Prompt parts returned by buildExtractionPrompt. */
export interface ExtractionPrompt {
  system: string;
  user: string;
}

/**
 * Build the system and user prompts for LLM rule extraction.
 *
 * The prompt instructs the LLM to output a JSON object with a
 * "rules" array containing candidates, each mapped to a known
 * pattern type.
 *
 * @param lines - Unparseable lines from the instruction file
 * @param knownPatternTypes - Pattern types the verifiers can handle
 * @returns System and user prompt strings
 */
export function buildExtractionPrompt(
  lines: string[],
  knownPatternTypes: string[],
): ExtractionPrompt {
  const system = `You are a rule extraction engine for RuleProbe, a tool that verifies AI coding agent output against instruction files.

Your task: map each instruction line to a machine-verifiable check, if possible.

Available pattern types (verifier checks that exist):
${knownPatternTypes.map((t) => `- ${t}`).join('\n')}

Available categories: ${[...VALID_CATEGORIES].join(', ')}
Available verifiers: ${[...VALID_VERIFIERS].join(', ')}

Respond with a JSON object: { "rules": [...] }
Each rule in the array must have:
- "id": short kebab-case identifier
- "category": one of the available categories
- "description": what the rule checks
- "verifier": one of the available verifiers
- "patternType": one of the available pattern types (MUST match exactly)
- "target": what files to check (e.g. "*.ts")
- "expected": the expected value (string or boolean)
- "scope": "file" or "project"
- "sourceLine": the original line this rule was extracted from (exact match)

Only include rules you are confident about. Only use pattern types from the list above. If a line cannot be mapped to any available pattern type, omit it.`;

  const user = `Extract rules from these instruction lines:\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;

  return { system, user };
}

/**
 * Parse and validate the LLM's JSON response.
 *
 * Filters out candidates with unknown pattern types or invalid fields.
 * Lines not covered by any valid candidate go into remaining.
 *
 * @param responseText - Raw JSON string from the LLM
 * @param originalLines - The lines that were sent to the LLM
 * @param knownPatternTypes - Valid pattern types
 * @returns Validated extraction result
 */
export function parseExtractionResponse(
  responseText: string,
  originalLines: string[],
  knownPatternTypes: string[],
): LlmExtractionResult {
  const knownTypes = new Set(knownPatternTypes);
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { candidates: [], remaining: [...originalLines] };
  }

  if (typeof parsed !== 'object' || parsed === null || !('rules' in parsed)) {
    return { candidates: [], remaining: [...originalLines] };
  }

  const rawRules = (parsed as { rules: unknown[] }).rules;
  if (!Array.isArray(rawRules)) {
    return { candidates: [], remaining: [...originalLines] };
  }

  const candidates: LlmRuleCandidate[] = [];
  const coveredLines = new Set<string>();

  for (const raw of rawRules) {
    const candidate = validateCandidate(raw, knownTypes);
    if (candidate) {
      candidates.push(candidate);
      const sourceLine = (raw as Record<string, unknown>)['sourceLine'];
      if (typeof sourceLine === 'string') {
        coveredLines.add(sourceLine);
      }
    }
  }

  const remaining = originalLines.filter((line) => !coveredLines.has(line));

  return { candidates, remaining };
}

/**
 * Validate a single raw candidate from the LLM response.
 *
 * @param raw - Raw object from the LLM's JSON output
 * @param knownTypes - Set of valid pattern types
 * @returns Validated candidate, or null if invalid
 */
function validateCandidate(
  raw: unknown,
  knownTypes: Set<string>,
): LlmRuleCandidate | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  const id = obj['id'];
  const category = obj['category'];
  const description = obj['description'];
  const verifier = obj['verifier'];
  const patternType = obj['patternType'];
  const target = obj['target'];
  const expected = obj['expected'];
  const scope = obj['scope'];

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) return null;
  if (typeof description !== 'string' || description.length === 0) return null;
  if (typeof verifier !== 'string' || !VALID_VERIFIERS.has(verifier)) return null;
  if (typeof patternType !== 'string' || !knownTypes.has(patternType)) return null;
  if (typeof target !== 'string') return null;
  if (typeof expected !== 'string' && typeof expected !== 'boolean') return null;
  if (scope !== 'file' && scope !== 'project') return null;

  return {
    id,
    category: category as RuleCategory,
    description,
    verifier: verifier as VerifierType,
    patternType,
    target,
    expected,
    scope,
  };
}
