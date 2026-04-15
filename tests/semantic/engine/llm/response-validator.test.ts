/**
 * Tests for LLM response validation.
 *
 * Covers valid, malformed, edge-case, and code-fenced responses.
 */

import { describe, it, expect } from 'vitest';
import {
  validateResponse,
  inconclusiveResponse,
  INCONCLUSIVE_COMPLIANCE,
} from '../../../../src/semantic/engine/llm/response-validator.js';

describe('validateResponse', () => {
  it('accepts a valid JSON response', () => {
    const raw = JSON.stringify({
      compliance: 0.85,
      reasoning: 'Strong alignment with profile',
      violations: ['missing catch_clause'],
      mitigations: ['test code may not need error handling'],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.response?.compliance).toBe(0.85);
    expect(result.response?.violations.length).toBe(1);
  });

  it('rejects non-JSON input', () => {
    const result = validateResponse('This is not JSON');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No JSON object found');
  });

  it('rejects missing compliance field', () => {
    const raw = JSON.stringify({
      reasoning: 'test',
      violations: [],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('compliance');
  });

  it('rejects compliance out of range (> 1)', () => {
    const raw = JSON.stringify({
      compliance: 1.5,
      reasoning: 'test',
      violations: [],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 1');
  });

  it('rejects compliance out of range (< 0)', () => {
    const raw = JSON.stringify({
      compliance: -0.1,
      reasoning: 'test',
      violations: [],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
  });

  it('rejects non-string reasoning', () => {
    const raw = JSON.stringify({
      compliance: 0.5,
      reasoning: 123,
      violations: [],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reasoning');
  });

  it('rejects non-array violations', () => {
    const raw = JSON.stringify({
      compliance: 0.5,
      reasoning: 'test',
      violations: 'not an array',
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('violations');
  });

  it('rejects violations containing non-strings', () => {
    const raw = JSON.stringify({
      compliance: 0.5,
      reasoning: 'test',
      violations: [123],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('violations[0]');
  });

  it('extracts JSON from markdown code fence', () => {
    const raw = '```json\n{"compliance":0.7,"reasoning":"ok","violations":[],"mitigations":[]}\n```';
    const result = validateResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.response?.compliance).toBe(0.7);
  });

  it('extracts JSON from surrounding text', () => {
    const raw = 'Here is my analysis:\n{"compliance":0.6,"reasoning":"partial","violations":["x"],"mitigations":[]}\nEnd.';
    const result = validateResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.response?.compliance).toBe(0.6);
  });

  it('accepts boundary compliance values (0 and 1)', () => {
    const raw0 = JSON.stringify({ compliance: 0, reasoning: 'r', violations: [], mitigations: [] });
    const raw1 = JSON.stringify({ compliance: 1, reasoning: 'r', violations: [], mitigations: [] });
    expect(validateResponse(raw0).valid).toBe(true);
    expect(validateResponse(raw1).valid).toBe(true);
  });

  it('accepts empty violations and mitigations arrays', () => {
    const raw = JSON.stringify({
      compliance: 0.5,
      reasoning: 'neutral',
      violations: [],
      mitigations: [],
    });
    const result = validateResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.response?.violations).toEqual([]);
  });
});

describe('inconclusiveResponse', () => {
  it('returns compliance of 0.5', () => {
    const response = inconclusiveResponse();
    expect(response.compliance).toBe(INCONCLUSIVE_COMPLIANCE);
    expect(response.compliance).toBe(0.5);
  });

  it('has a reasoning string mentioning inconclusive', () => {
    const response = inconclusiveResponse();
    expect(response.reasoning).toContain('inconclusive');
  });

  it('has empty violations and mitigations', () => {
    const response = inconclusiveResponse();
    expect(response.violations).toEqual([]);
    expect(response.mitigations).toEqual([]);
  });
});
