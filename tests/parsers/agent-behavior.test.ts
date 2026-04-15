/**
 * Tests for agent-behavior statement classification.
 *
 * Verifies that LLM conversation style rules (which cannot be
 * verified from code) are classified as AGENT_BEHAVIOR and not
 * confused with actionable code rules.
 */

import { describe, it, expect } from 'vitest';
import { classifyStatement } from '../../src/parsers/classify-statement.js';

describe('agent-behavior classification', () => {
  it('classifies "Be terse" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Be terse', 'bullet', 'Communication', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('classifies "Be concise in responses" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Be concise in your responses', 'bullet', 'Style', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('classifies "don\'t explain unless asked" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement("Don't explain unless asked", 'bullet', 'Rules', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('classifies "don\'t apologize" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement("Don't apologize in your response", 'bullet', 'Style', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('classifies "keep responses short" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Keep responses short and focused', 'bullet', 'Style', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('classifies "think step by step" as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Think step-by-step before answering', 'bullet', 'Process', '');
    expect(result.category).toBe('AGENT_BEHAVIOR');
  });

  it('does not classify tooling instructions as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Use prettier for formatting', 'bullet', 'Tools', '');
    expect(result.category).not.toBe('AGENT_BEHAVIOR');
  });

  it('does not classify naming rules as AGENT_BEHAVIOR', () => {
    const result = classifyStatement('Use camelCase for variables', 'bullet', 'Naming', '');
    expect(result.category).not.toBe('AGENT_BEHAVIOR');
  });

  it('does not classify code style rules as AGENT_BEHAVIOR', () => {
    const result = classifyStatement(
      'Use early return to avoid deep nesting',
      'bullet',
      'Code Style',
      '',
    );
    expect(result.category).not.toBe('AGENT_BEHAVIOR');
  });
});
