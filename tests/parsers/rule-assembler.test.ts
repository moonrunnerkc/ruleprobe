/**
 * Tests for Pass 3: Rule assembly.
 *
 * Verifies that classified statements are correctly assembled into Rule[]
 * objects, with proper matcher integration and deduplication.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assembleRules,
  resetAssemblerCounter,
} from '../../src/parsers/rule-assembler.js';
import type { ClassifiedStatement } from '../../src/parsers/pipeline-types.js';

function makeStmt(
  text: string,
  category: ClassifiedStatement['category'],
  sectionHeader: string = 'Test Section',
  confidence: number = 0.95,
): ClassifiedStatement {
  return {
    text,
    category,
    confidence,
    sectionHeader,
    blockType: 'bullet',
    sectionDepth: 2,
  };
}

describe('rule assembler: matcher integration', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('matches IMPERATIVE_DIRECT against existing matchers when possible', () => {
    const stmts = [
      makeStmt('Use camelCase for variable names', 'IMPERATIVE_DIRECT'),
    ];
    const { rules } = assembleRules(stmts);
    const camelRule = rules.find((r) => r.id.includes('naming-camelcase'));
    expect(camelRule).toBeDefined();
    expect(camelRule?.category).toBe('naming');
  });

  it('creates generic rule when no matcher applies', () => {
    const stmts = [
      makeStmt('Keep functions focused and small', 'CODE_STYLE'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules.length).toBeGreaterThan(0);
    const rule = rules[0];
    expect(rule?.id).toContain('code-style');
  });

  it('separates CONTEXT_ONLY into contextOnly array', () => {
    const stmts = [
      makeStmt('This is a TypeScript project', 'CONTEXT_ONLY'),
    ];
    const { rules, contextOnly } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(contextOnly).toHaveLength(1);
  });

  it('separates UNKNOWN into unclassified if no matcher matches', () => {
    const stmts = [
      makeStmt('some random text with no patterns', 'UNKNOWN'),
    ];
    const { rules, unclassified } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unclassified).toHaveLength(1);
  });

  it('UNKNOWN still tries matchers before giving up', () => {
    const stmts = [
      makeStmt('No any types allowed', 'UNKNOWN'),
    ];
    const { rules, unclassified } = assembleRules(stmts);
    const anyRule = rules.find((r) => r.id.includes('forbidden-no-any'));
    expect(anyRule).toBeDefined();
    expect(unclassified).toHaveLength(0);
  });
});

describe('rule assembler: deduplication', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('deduplicates rules with the same matcher ID prefix', () => {
    const stmts = [
      makeStmt('Use camelCase for variables', 'IMPERATIVE_DIRECT'),
      makeStmt('Variables should be camelCase', 'IMPERATIVE_DIRECT'),
    ];
    const { rules } = assembleRules(stmts);
    const camelRules = rules.filter((r) => r.id.includes('naming-camelcase-variables'));
    expect(camelRules).toHaveLength(1);
  });
});

describe('rule assembler: WORKFLOW and PATTERN_REFERENCE', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('extracts WORKFLOW as non-verifiable rules', () => {
    const stmts = [
      makeStmt('Create a PR for each feature', 'WORKFLOW'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]?.id).toContain('workflow');
  });

  it('extracts PATTERN_REFERENCE as non-verifiable rules', () => {
    const stmts = [
      makeStmt('Follow existing patterns in the codebase', 'PATTERN_REFERENCE'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]?.id).toContain('pattern-ref');
  });
});

describe('rule assembler: qualifier detection', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('detects "always" qualifier', () => {
    const stmts = [
      makeStmt('Always use strict mode', 'IMPERATIVE_DIRECT'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.qualifier).toBe('always');
  });

  it('detects "never" qualifier', () => {
    const stmts = [
      makeStmt('Never commit directly to main', 'IMPERATIVE_DIRECT'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.qualifier).toBe('never');
  });

  it('detects "prefer" qualifier', () => {
    const stmts = [
      makeStmt('Prefer functional components', 'PREFER_PATTERN'),
    ];
    const { rules } = assembleRules(stmts);
    const prefRule = rules.find((r) => r.qualifier === 'prefer');
    expect(prefRule).toBeDefined();
  });
});

describe('rule assembler: section context', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('preserves section header on assembled rules', () => {
    const stmts = [
      makeStmt('Use camelCase for variables', 'IMPERATIVE_DIRECT', 'Naming Conventions'),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.section).toBe('Naming Conventions');
  });
});

describe('rule assembler: confidence mapping', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('maps high confidence correctly', () => {
    const stmts = [
      makeStmt('Keep functions small', 'CODE_STYLE', 'Style', 0.95),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.confidence).toBe('high');
  });

  it('maps medium confidence correctly', () => {
    const stmts = [
      makeStmt('Functions should be short', 'CODE_STYLE', 'Style', 0.75),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.confidence).toBe('medium');
  });

  it('maps low confidence correctly', () => {
    const stmts = [
      makeStmt('Some style thing', 'CODE_STYLE', 'Style', 0.50),
    ];
    const { rules } = assembleRules(stmts);
    expect(rules[0]?.confidence).toBe('low');
  });
});
