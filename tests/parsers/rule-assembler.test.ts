/**
 * Tests for Pass 3: Rule assembly.
 *
 * Verifies that classified statements are correctly assembled into Rule[]
 * objects, with proper matcher integration and deduplication.
 * Generic categories without concrete matcher implementations
 * now go to unparseable rather than producing false-passing rules.
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

  it('sends CODE_STYLE with no matcher to unparseable', () => {
    const stmts = [
      makeStmt('Keep functions focused and small', 'CODE_STYLE'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
    expect(unparseable[0]).toContain('Keep functions focused');
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

describe('rule assembler: unverifiable categories', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('sends WORKFLOW to unparseable instead of creating a generic rule', () => {
    const stmts = [
      makeStmt('Create a PR for each feature', 'WORKFLOW'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
    expect(unparseable[0]).toContain('Create a PR');
  });

  it('sends PATTERN_REFERENCE to unparseable instead of creating a generic rule', () => {
    const stmts = [
      makeStmt('Follow existing patterns in the codebase', 'PATTERN_REFERENCE'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
    expect(unparseable[0]).toContain('Follow existing patterns');
  });

  it('sends AGENT_BEHAVIOR to unparseable', () => {
    const stmts = [
      makeStmt('Always review code before merging', 'AGENT_BEHAVIOR'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
  });

  it('sends IMPERATIVE_DIRECT without a matcher to unparseable', () => {
    const stmts = [
      makeStmt('Always use strict mode', 'IMPERATIVE_DIRECT'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
  });

  it('sends PREFER_PATTERN without a matcher to unparseable', () => {
    const stmts = [
      makeStmt('Prefer functional components', 'PREFER_PATTERN'),
    ];
    const { rules, unparseable } = assembleRules(stmts);
    expect(rules).toHaveLength(0);
    expect(unparseable).toHaveLength(1);
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

describe('rule assembler: matched rules have correct confidence', () => {
  beforeEach(() => { resetAssemblerCounter(); });

  it('sets confidence to high for matched rules', () => {
    const stmts = [
      makeStmt('No any types allowed', 'IMPERATIVE_DIRECT', 'Types', 0.95),
    ];
    const { rules } = assembleRules(stmts);
    const anyRule = rules.find((r) => r.id.includes('forbidden-no-any'));
    expect(anyRule).toBeDefined();
    expect(anyRule?.confidence).toBe('high');
  });
});