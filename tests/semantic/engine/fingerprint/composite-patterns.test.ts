/**
 * Tests for composite pattern evaluation.
 *
 * Verifies multi-node conjunction detection for error-handling,
 * component-structure, and testing-patterns topics.
 */

import { describe, it, expect } from 'vitest';
import type { RawFileVector } from '../../../../src/semantic/types.js';
import {
  evaluateComposites,
  COMPOSITE_REGISTRY,
  ERROR_HANDLING_COMPOSITES,
  COMPONENT_STRUCTURE_COMPOSITES,
  TESTING_PATTERNS_COMPOSITES,
} from '../../../../src/semantic/engine/fingerprint/composite-patterns.js';

function makeVector(counts: Record<string, number>): RawFileVector {
  return {
    nodeTypeCounts: counts,
    nestingDepths: {},
    subTreeHashes: [],
  };
}

describe('COMPOSITE_REGISTRY', () => {
  it('has definitions for error-handling, component-structure, testing-patterns', () => {
    expect(COMPOSITE_REGISTRY.has('error-handling')).toBe(true);
    expect(COMPOSITE_REGISTRY.has('component-structure')).toBe(true);
    expect(COMPOSITE_REGISTRY.has('testing-patterns')).toBe(true);
  });

  it('returns empty for unknown topics', () => {
    expect(COMPOSITE_REGISTRY.has('unknown-topic')).toBe(false);
  });
});

describe('evaluateComposites: error-handling', () => {
  it('detects try-catch-with-logging when all nodes present', () => {
    const vector = makeVector({
      try_statement: 2,
      catch_clause: 2,
      call_expression: 5,
    });
    const results = evaluateComposites('error-handling', vector);
    const tryCatchLog = results.find((r) => r.compositeId === 'try-catch-with-logging');
    expect(tryCatchLog).toBeDefined();
    expect(tryCatchLog?.value).toBe(1);
  });

  it('does not fire try-catch-with-logging when catch is missing', () => {
    const vector = makeVector({
      try_statement: 2,
      call_expression: 5,
    });
    const results = evaluateComposites('error-handling', vector);
    const tryCatchLog = results.find((r) => r.compositeId === 'try-catch-with-logging');
    expect(tryCatchLog?.value).toBe(0);
  });

  it('detects try-catch-with-rethrow', () => {
    const vector = makeVector({
      try_statement: 1,
      catch_clause: 1,
      throw_statement: 1,
    });
    const results = evaluateComposites('error-handling', vector);
    const rethrow = results.find((r) => r.compositeId === 'try-catch-with-rethrow');
    expect(rethrow?.value).toBe(1);
  });

  it('detects custom-error-class', () => {
    const vector = makeVector({
      class_declaration: 1,
      throw_statement: 1,
    });
    const results = evaluateComposites('error-handling', vector);
    const custom = results.find((r) => r.compositeId === 'custom-error-class');
    expect(custom?.value).toBe(1);
  });

  it('returns 0 for custom-error-class without throw', () => {
    const vector = makeVector({
      class_declaration: 1,
    });
    const results = evaluateComposites('error-handling', vector);
    const custom = results.find((r) => r.compositeId === 'custom-error-class');
    expect(custom?.value).toBe(0);
  });

  it('returns correct count of composites', () => {
    const results = evaluateComposites('error-handling', makeVector({}));
    expect(results.length).toBe(ERROR_HANDLING_COMPOSITES.length);
  });
});

describe('evaluateComposites: component-structure', () => {
  it('detects functional-component-with-hooks', () => {
    const vector = makeVector({
      arrow_function: 1,
      call_expression: 3,
    });
    const results = evaluateComposites('component-structure', vector);
    const fc = results.find((r) => r.compositeId === 'functional-component-with-hooks');
    expect(fc?.value).toBe(1);
  });

  it('requires at least 2 call_expressions for hooks composite', () => {
    const vector = makeVector({
      arrow_function: 1,
      call_expression: 1,
    });
    const results = evaluateComposites('component-structure', vector);
    const fc = results.find((r) => r.compositeId === 'functional-component-with-hooks');
    expect(fc?.value).toBe(0);
  });

  it('detects component-with-prop-types', () => {
    const vector = makeVector({
      arrow_function: 1,
      interface_declaration: 1,
    });
    const results = evaluateComposites('component-structure', vector);
    const pt = results.find((r) => r.compositeId === 'component-with-prop-types');
    expect(pt?.value).toBe(1);
  });

  it('returns correct count of composites', () => {
    const results = evaluateComposites('component-structure', makeVector({}));
    expect(results.length).toBe(COMPONENT_STRUCTURE_COMPOSITES.length);
  });
});

describe('evaluateComposites: testing-patterns', () => {
  it('detects describe-it-with-assertions', () => {
    const vector = makeVector({
      call_expression: 5,
      member_expression: 2,
    });
    const results = evaluateComposites('testing-patterns', vector);
    const desc = results.find((r) => r.compositeId === 'describe-it-with-assertions');
    expect(desc?.value).toBe(1);
  });

  it('detects test-with-mocks', () => {
    const vector = makeVector({
      call_expression: 4,
      arrow_function: 1,
      member_expression: 2,
    });
    const results = evaluateComposites('testing-patterns', vector);
    const mocks = results.find((r) => r.compositeId === 'test-with-mocks');
    expect(mocks?.value).toBe(1);
  });

  it('returns correct count of composites', () => {
    const results = evaluateComposites('testing-patterns', makeVector({}));
    expect(results.length).toBe(TESTING_PATTERNS_COMPOSITES.length);
  });
});

describe('evaluateComposites: unknown topic', () => {
  it('returns empty array for topic without composites', () => {
    const results = evaluateComposites('validation', makeVector({ call_expression: 5 }));
    expect(results).toEqual([]);
  });
});
