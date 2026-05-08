/**
 * Rubric decomposition prompt construction and response parsing.
 *
 * Builds prompts that instruct the LLM to break subjective instructions
 * into weighted sets of concrete proxy checks. Validates responses
 * against known pattern types and ensures weights sum to 1.
 */

import type { RuleCategory, VerifierType } from '../types.js';
import type { DecomposedRubric, DecompositionResult, RubricCheck } from './rubric-types.js';

/** Valid categories for rubric checks. */
const VALID_CATEGORIES: ReadonlySet<string> = new Set<RuleCategory>([
  'naming', 'forbidden-pattern', 'structure',
  'import-pattern', 'error-handling', 'type-safety', 'code-style',
]);

/** Valid verifier types for rubric checks. */
const VALID_VERIFIERS: ReadonlySet<string> = new Set<VerifierType>([
  'ast', 'regex', 'filesystem',
]);

/** Prompt pair for rubric decomposition. */
export interface RubricPrompt {
  system: string;
  user: string;
}

/**
 * Build the prompts for rubric decomposition.
 *
 * Instructs the LLM to decompose subjective lines into concrete
 * proxy checks with weights, each using a known pattern type.
 *
 * @param lines - Subjective instruction lines
 * @param knownPatternTypes - Available pattern types
 * @returns System and user prompt strings
 */
export function buildRubricPrompt(
  lines: string[],
  knownPatternTypes: string[],
): RubricPrompt {
  const system = `You are a rubric decomposition engine for RuleProbe.

Your task: take subjective coding instructions and decompose each one into 2-5 concrete, measurable proxy checks. Each proxy check must map to an available pattern type.

For example, "write clean code" could decompose into:
- No functions over 50 lines (max-function-length, weight 0.25)
- No magic numbers (no-magic-numbers, weight 0.2)
- No deeply nested ternaries (no-nested-ternary, weight 0.15)
- JSDoc on public functions (jsdoc-public, weight 0.2)
- No console.log (no-console-log, weight 0.2)

Available pattern types:
${knownPatternTypes.map((t) => `- ${t}`).join('\n')}

Available categories: ${[...VALID_CATEGORIES].join(', ')}
Available verifiers: ${[...VALID_VERIFIERS].join(', ')}

Respond with JSON: { "rubrics": [...] }
Each rubric must have:
- "sourceLine": the original instruction (exact match from input)
- "category": one of the available categories
- "summary": brief description of what the rubric measures
- "checks": array of 2-5 proxy checks, each with:
  - "id": short kebab-case identifier
  - "description": what this specific check verifies
  - "weight": number 0-1 (weights in each rubric must sum to 1.0)
  - "verifier": one of the available verifiers
  - "patternType": MUST be one of the available pattern types
  - "target": file pattern (e.g. "*.ts", "variables")
  - "expected": expected value (string or boolean)
  - "scope": "file" or "project"

Only use pattern types from the list. Weights must sum to 1.0 per rubric. If a line is purely opinion with no measurable proxy, omit it.`;

  const user = `Decompose these subjective instructions into measurable rubrics:\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;

  return { system, user };
}

/**
 * Parse and validate the LLM rubric decomposition response.
 *
 * Filters out rubrics with invalid checks, normalizes weights,
 * and puts unmapped lines into remaining.
 *
 * @param responseText - Raw JSON from the LLM
 * @param originalLines - Lines sent for decomposition
 * @param knownPatternTypes - Valid pattern types
 * @returns Validated decomposition result
 */
export function parseRubricResponse(
  responseText: string,
  originalLines: string[],
  knownPatternTypes: string[],
): DecompositionResult {
  const knownTypes = new Set(knownPatternTypes);
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { rubrics: [], remaining: [...originalLines] };
  }

  if (typeof parsed !== 'object' || parsed === null || !('rubrics' in parsed)) {
    return { rubrics: [], remaining: [...originalLines] };
  }

  const rawRubrics = (parsed as { rubrics: unknown[] }).rubrics;
  if (!Array.isArray(rawRubrics)) {
    return { rubrics: [], remaining: [...originalLines] };
  }

  const rubrics: DecomposedRubric[] = [];
  const coveredLines = new Set<string>();

  for (const raw of rawRubrics) {
    const rubric = validateRubric(raw, knownTypes);
    if (rubric) {
      rubrics.push(rubric);
      coveredLines.add(rubric.sourceLine);
    }
  }

  const remaining = originalLines.filter((line) => !coveredLines.has(line));
  return { rubrics, remaining };
}

/**
 * Validate a single rubric from the LLM response.
 */
function validateRubric(
  raw: unknown,
  knownTypes: Set<string>,
): DecomposedRubric | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const sourceLine = obj['sourceLine'];
  const category = obj['category'];
  const summary = obj['summary'];
  const checks = obj['checks'];

  if (typeof sourceLine !== 'string' || sourceLine.length === 0) return null;
  if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) return null;
  if (typeof summary !== 'string' || summary.length === 0) return null;
  if (!Array.isArray(checks) || checks.length < 2 || checks.length > 5) return null;

  const validChecks: RubricCheck[] = [];
  for (const check of checks) {
    const validated = validateCheck(check, knownTypes);
    if (validated) {
      validChecks.push(validated);
    }
  }

  if (validChecks.length < 2) {
    return null;
  }

  normalizeWeights(validChecks);

  return {
    sourceLine,
    category: category as RuleCategory,
    summary,
    checks: validChecks,
  };
}

/**
 * Validate a single check within a rubric.
 */
function validateCheck(
  raw: unknown,
  knownTypes: Set<string>,
): RubricCheck | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const id = obj['id'];
  const description = obj['description'];
  const weight = obj['weight'];
  const verifier = obj['verifier'];
  const patternType = obj['patternType'];
  const target = obj['target'];
  const expected = obj['expected'];
  const scope = obj['scope'];

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof description !== 'string' || description.length === 0) return null;
  if (typeof weight !== 'number' || weight <= 0 || weight > 1) return null;
  if (typeof verifier !== 'string' || !VALID_VERIFIERS.has(verifier)) return null;
  if (typeof patternType !== 'string' || !knownTypes.has(patternType)) return null;
  if (typeof target !== 'string') return null;
  if (typeof expected !== 'string' && typeof expected !== 'boolean') return null;
  if (scope !== 'file' && scope !== 'project') return null;

  return {
    id,
    description,
    weight,
    verifier: verifier as VerifierType,
    patternType,
    target,
    expected,
    scope,
  };
}

/**
 * Normalize check weights so they sum to 1.0.
 */
function normalizeWeights(checks: RubricCheck[]): void {
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(total - 1.0) > 0.01) {
    for (const check of checks) {
      check.weight = check.weight / total;
    }
  }
}
