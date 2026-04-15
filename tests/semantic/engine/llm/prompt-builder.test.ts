/**
 * Tests for semantic judgment prompt builder.
 *
 * Verifies: (a) well-formed prompts, (b) NO raw code in any prompt.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureVector } from '../../../../src/semantic/types.js';
import type { StructuralDelta } from '../../../../src/semantic/engine/comparison/structural-delta.js';
import { buildSemanticPrompt, SEMANTIC_MODEL } from '../../../../src/semantic/engine/llm/prompt-builder.js';

function makePromptParams() {
  const profileVector: FeatureVector = {
    nodeTypeCounts: { try_statement: 5.0, catch_clause: 4.5 },
    nestingDepths: { try_statement: 1.2 },
    patternSignatures: ['abc123def456', 'fed987654321'],
    prevalence: 0.3,
  };

  const targetVector: FeatureVector = {
    nodeTypeCounts: { try_statement: 2.0 },
    nestingDepths: { try_statement: 0.8 },
    patternSignatures: ['fed987654321'],
    prevalence: 0.1,
  };

  const delta: StructuralDelta = {
    missingFromTarget: [{ nodeType: 'catch_clause', expectedCount: 4.5 }],
    extraInTarget: [],
    missingSignatures: ['abc123def456'],
    extraSignatures: [],
  };

  return {
    topic: 'error-handling',
    profileVector,
    targetVector,
    similarityScore: 0.72,
    fastPathThreshold: 0.85,
    delta,
    ruleText: 'Use try/catch for error handling',
    sampleSize: 50,
  };
}

describe('buildSemanticPrompt', () => {
  it('includes the topic name', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('error-handling');
  });

  it('includes the rule text', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('Use try/catch for error handling');
  });

  it('includes similarity score', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('0.7200');
  });

  it('includes the fast-path threshold', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('0.8500');
  });

  it('includes the sample size', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('50 files');
  });

  it('includes node type counts', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('try_statement:5.0');
    expect(prompt).toContain('catch_clause:4.5');
  });

  it('includes the delta information', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('catch_clause');
    expect(prompt).toContain('expected ~4.5');
  });

  it('requests JSON response format', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).toContain('"compliance"');
    expect(prompt).toContain('"reasoning"');
    expect(prompt).toContain('"violations"');
    expect(prompt).toContain('"mitigations"');
  });

  it('SEMANTIC_MODEL is claude-sonnet-4-6', () => {
    expect(SEMANTIC_MODEL).toBe('claude-sonnet-4-6');
  });
});

describe('prompt privacy gate', () => {
  it('contains NO raw code patterns', () => {
    const prompt = buildSemanticPrompt(makePromptParams());

    // Must not contain common code patterns
    expect(prompt).not.toMatch(/function\s+\w+\s*\(/);
    expect(prompt).not.toMatch(/const\s+\w+\s*=/);
    expect(prompt).not.toMatch(/let\s+\w+\s*=/);
    expect(prompt).not.toMatch(/var\s+\w+\s*=/);
    expect(prompt).not.toMatch(/import\s+\{/);
    expect(prompt).not.toMatch(/import\s+\w+\s+from/);
    expect(prompt).not.toMatch(/require\s*\(/);
    expect(prompt).not.toMatch(/export\s+(class|function|const|interface)/);
    expect(prompt).not.toMatch(/=>\s*\{/);
  });

  it('contains no file paths', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    expect(prompt).not.toMatch(/\/(src|lib|app|components)\//);
    expect(prompt).not.toMatch(/\.tsx?:/);
    expect(prompt).not.toMatch(/\.jsx?:/);
  });

  it('contains no variable or function names beyond node types', () => {
    const prompt = buildSemanticPrompt(makePromptParams());
    // Node type names like try_statement, catch_clause are allowed
    // But real variable/function names like "handleError", "fetchData" should not appear
    expect(prompt).not.toContain('handleError');
    expect(prompt).not.toContain('fetchData');
    expect(prompt).not.toContain('useState');
    expect(prompt).not.toContain('componentDidMount');
  });
});
