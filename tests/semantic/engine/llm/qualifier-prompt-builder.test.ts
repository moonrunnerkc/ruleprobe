import { describe, it, expect } from 'vitest';
import {
  buildQualifierPrompt,
  validateQualifierPromptPrivacy,
} from '../../../../src/semantic/engine/llm/qualifier-prompt-builder.js';
import type { QualifierContext } from '../../../../src/semantic/types.js';
import type { StructuralDelta } from '../../../../src/semantic/engine/comparison/structural-delta.js';

function allFalseCtx(): QualifierContext {
  return {
    inTightLoop: false,
    thirdPartyBoundary: false,
    deviationCommentPresent: false,
    frameworkConstraintDetected: false,
    legacyCodeRegion: false,
    testCode: false,
    variableReassigned: false,
  };
}

function emptyDelta(): StructuralDelta {
  return {
    missingFromTarget: [],
    extraInTarget: [],
    missingSignatures: [],
    extraSignatures: [],
  };
}

describe('buildQualifierPrompt', () => {
  it('includes the rule text', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'Avoid using eval unless absolutely necessary',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(prompt).toContain('Avoid using eval unless absolutely necessary');
  });

  it('includes qualifier type', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(prompt).toContain('Qualifier type: "avoid-unless"');
  });

  it('includes all context flags as false', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(prompt).toContain('In tight loop: false');
    expect(prompt).toContain('Third-party boundary: false');
    expect(prompt).toContain('Deviation comment present: false');
    expect(prompt).toContain('Framework constraint: false');
    expect(prompt).toContain('Legacy code region: false');
    expect(prompt).toContain('Test code: false');
    expect(prompt).toContain('Variable reassigned: false');
  });

  it('shows true context flags when present', () => {
    const ctx = { ...allFalseCtx(), inTightLoop: true, testCode: true };
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: ctx,
      delta: emptyDelta(),
    });
    expect(prompt).toContain('In tight loop: true');
    expect(prompt).toContain('Test code: true');
  });

  it('includes the delta information', () => {
    const delta: StructuralDelta = {
      missingFromTarget: [{ nodeType: 'TryStatement', expectedCount: 5 }],
      extraInTarget: [{ nodeType: 'ThrowStatement', actualCount: 3 }],
      missingSignatures: ['abc123'],
      extraSignatures: ['def456'],
    };
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta,
    });
    expect(prompt).toContain('TryStatement');
    expect(prompt).toContain('ThrowStatement');
  });

  it('asks the correct question', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(prompt).toContain('Is there a structural reason this deviation might be justified?');
  });

  it('requests JSON response format', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'test rule',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(prompt).toContain('"justified"');
    expect(prompt).toContain('"reason"');
    expect(prompt).toContain('"confidence"');
  });
});

describe('validateQualifierPromptPrivacy', () => {
  it('passes for a valid qualifier prompt', () => {
    const prompt = buildQualifierPrompt({
      ruleText: 'Avoid eval unless needed',
      qualifierType: 'avoid-unless',
      context: allFalseCtx(),
      delta: emptyDelta(),
    });
    expect(validateQualifierPromptPrivacy(prompt)).toBe(true);
  });

  it('fails if prompt contains function declaration', () => {
    expect(validateQualifierPromptPrivacy('function doSomething() {}')).toBe(false);
  });

  it('fails if prompt contains const assignment', () => {
    expect(validateQualifierPromptPrivacy('const myVar = 42')).toBe(false);
  });

  it('fails if prompt contains import statement', () => {
    expect(validateQualifierPromptPrivacy("import { foo } from 'bar'")).toBe(false);
  });

  it('fails if prompt contains arrow function', () => {
    expect(validateQualifierPromptPrivacy('=> {')).toBe(false);
  });

  it('passes for numeric-only content', () => {
    expect(validateQualifierPromptPrivacy('TryStatement: 5, CatchClause: 3')).toBe(true);
  });
});
