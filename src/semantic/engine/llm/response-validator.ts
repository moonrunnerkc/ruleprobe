/**
 * Strict JSON schema validation for LLM responses.
 *
 * Validates that LLM responses match the expected schema
 * exactly. On failure, allows one retry. On second failure,
 * returns an inconclusive verdict with compliance 0.5.
 */

/** Expected shape of a semantic judgment LLM response. */
export interface SemanticLlmResponse {
  compliance: number;
  reasoning: string;
  violations: string[];
  mitigations: string[];
}

/**
 * Compliance score for inconclusive LLM responses.
 * Used when response validation fails after retry.
 *
 * Source: ASPE architecture spec, conservative middle value.
 */
export const INCONCLUSIVE_COMPLIANCE = 0.5;

/** Result of validating an LLM response. */
export interface ValidationResult {
  valid: boolean;
  response: SemanticLlmResponse | null;
  error: string | null;
}

/**
 * Validate and parse an LLM response string.
 *
 * Expects a JSON object with compliance (number 0-1),
 * reasoning (string), violations (string[]), and
 * mitigations (string[]).
 *
 * @param raw - Raw response string from the LLM
 * @returns Validation result with parsed response or error
 */
export function validateResponse(raw: string): ValidationResult {
  let parsed: unknown;

  try {
    parsed = extractJson(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown parse error';
    return { valid: false, response: null, error: `JSON parse failed: ${message}` };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, response: null, error: 'Response is not a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  const complianceError = validateCompliance(obj['compliance']);
  if (complianceError) {
    return { valid: false, response: null, error: complianceError };
  }

  const reasoningError = validateString(obj['reasoning'], 'reasoning');
  if (reasoningError) {
    return { valid: false, response: null, error: reasoningError };
  }

  const violationsError = validateStringArray(obj['violations'], 'violations');
  if (violationsError) {
    return { valid: false, response: null, error: violationsError };
  }

  const mitigationsError = validateStringArray(obj['mitigations'], 'mitigations');
  if (mitigationsError) {
    return { valid: false, response: null, error: mitigationsError };
  }

  return {
    valid: true,
    response: {
      compliance: obj['compliance'] as number,
      reasoning: obj['reasoning'] as string,
      violations: obj['violations'] as string[],
      mitigations: obj['mitigations'] as string[],
    },
    error: null,
  };
}

/**
 * Build an inconclusive verdict response for failed validations.
 *
 * @returns A SemanticLlmResponse with 0.5 compliance
 */
export function inconclusiveResponse(): SemanticLlmResponse {
  return {
    compliance: INCONCLUSIVE_COMPLIANCE,
    reasoning: 'LLM response could not be validated; marked as semantic-inconclusive',
    violations: [],
    mitigations: [],
  };
}

/**
 * Extract a JSON object from a string that may contain surrounding text.
 *
 * Handles LLM responses that include markdown code fences or
 * explanatory text around the JSON.
 *
 * @param raw - Raw string possibly containing JSON
 * @returns Parsed JSON value
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not direct JSON; try extraction
  }

  // Try extracting from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Try extracting first { ... } block
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(trimmed.slice(braceStart, braceEnd + 1));
  }

  throw new Error('No JSON object found in response');
}

/**
 * Validate the compliance field.
 *
 * @param value - The value to check
 * @returns Error message, or null if valid
 */
function validateCompliance(value: unknown): string | null {
  if (typeof value !== 'number') {
    return 'compliance must be a number';
  }
  if (value < 0 || value > 1) {
    return 'compliance must be between 0 and 1';
  }
  if (Number.isNaN(value)) {
    return 'compliance must not be NaN';
  }
  return null;
}

/**
 * Validate a required string field.
 *
 * @param value - The value to check
 * @param fieldName - Name for error messages
 * @returns Error message, or null if valid
 */
function validateString(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  return null;
}

/**
 * Validate a required string array field.
 *
 * @param value - The value to check
 * @param fieldName - Name for error messages
 * @returns Error message, or null if valid
 */
function validateStringArray(value: unknown, fieldName: string): string | null {
  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      return `${fieldName}[${i}] must be a string`;
    }
  }
  return null;
}
