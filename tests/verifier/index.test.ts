import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { verifyOutput } from '../../src/verifier/index.js';
import type { Rule, RuleSet } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingDir = resolve(fixturesDir, 'passing');
const failingDir = resolve(fixturesDir, 'failing');

/**
 * Build a minimal RuleSet for integration testing.
 * Uses the passing fixtures as the "source file" path, which is
 * irrelevant to verification but needed by the type.
 */
function buildRuleSet(rules: Rule[]): RuleSet {
  return {
    sourceFile: 'test-instructions.md',
    sourceType: 'unknown',
    rules,
    unparseable: [],
  };
}

function makeRule(
  id: string,
  category: Rule['category'],
  verifier: Rule['verifier'],
  patternType: string,
  target: string,
  expected: string | boolean,
  scope: 'file' | 'project' = 'file',
): Rule {
  return { id, category, source: 'test', description: id, severity: 'error', verifier, pattern: { type: patternType, target, expected, scope } };
}

// -- Integration: Passing fixtures produce zero violations --

describe('Verifier orchestrator: passing fixtures', () => {
  const rules: Rule[] = [
    makeRule('naming-camelcase-vars', 'naming', 'ast', 'camelCase', 'variables', true),
    makeRule('naming-pascalcase-types', 'naming', 'ast', 'PascalCase', 'types', true),
    makeRule('no-any', 'forbidden-pattern', 'ast', 'no-any', '*', true),
    makeRule('no-console', 'forbidden-pattern', 'ast', 'no-console-log', '*', true),
    makeRule('named-exports', 'structure', 'ast', 'named-exports-only', '*', true),
    makeRule('jsdoc', 'structure', 'ast', 'jsdoc-required', 'exported-functions', true),
    makeRule('kebab-files', 'naming', 'filesystem', 'kebab-case', 'filenames', true),
    makeRule('tests-exist', 'test-requirement', 'filesystem', 'test-files-exist', 'src/**/*.ts', true),
    makeRule('max-line', 'forbidden-pattern', 'regex', 'max-line-length', '*.ts', '120'),
    makeRule('max-file', 'structure', 'filesystem', 'max-file-length', '*.ts', '300'),
    makeRule('strict-mode', 'structure', 'filesystem', 'strict-mode', 'tsconfig.json', true, 'project'),
  ];

  it('returns all rules as passing', () => {
    const ruleSet = buildRuleSet(rules);
    const results = verifyOutput(ruleSet, passingDir);

    expect(results).toHaveLength(rules.length);
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it('preserves rule order in results', () => {
    const ruleSet = buildRuleSet(rules);
    const results = verifyOutput(ruleSet, passingDir);

    for (let i = 0; i < rules.length; i++) {
      expect(results[i]!.rule.id).toBe(rules[i]!.id);
    }
  });
});

// -- Integration: Failing fixtures produce the expected violations --

describe('Verifier orchestrator: failing fixtures', () => {
  const rules: Rule[] = [
    makeRule('naming-camelcase-vars', 'naming', 'ast', 'camelCase', 'variables', true),
    makeRule('no-any', 'forbidden-pattern', 'ast', 'no-any', '*', true),
    makeRule('no-console', 'forbidden-pattern', 'ast', 'no-console-log', '*', true),
    makeRule('named-exports', 'structure', 'ast', 'named-exports-only', '*', true),
    makeRule('jsdoc', 'structure', 'ast', 'jsdoc-required', 'exported-functions', true),
    makeRule('kebab-files', 'naming', 'filesystem', 'kebab-case', 'filenames', true),
    makeRule('tests-exist', 'test-requirement', 'filesystem', 'test-files-exist', 'src/**/*.ts', true),
    makeRule('max-line', 'forbidden-pattern', 'regex', 'max-line-length', '*.ts', '100'),
    makeRule('max-file', 'structure', 'filesystem', 'max-file-length', '*.ts', '300'),
    makeRule('strict-mode', 'structure', 'filesystem', 'strict-mode', 'tsconfig.json', true, 'project'),
  ];

  it('flags multiple rules as failing', () => {
    const ruleSet = buildRuleSet(rules);
    const results = verifyOutput(ruleSet, failingDir);

    const failed = results.filter((r) => !r.passed);
    // strict-mode passes (ancestor walk finds project root tsconfig.json), rest fail
    expect(failed.length).toBe(rules.length - 1);
  });

  it('routes rules to the correct verifiers', () => {
    const ruleSet = buildRuleSet(rules);
    const results = verifyOutput(ruleSet, failingDir);

    const astResults = results.filter((r) => r.rule.verifier === 'ast');
    const fsResults = results.filter((r) => r.rule.verifier === 'filesystem');
    const regexResults = results.filter((r) => r.rule.verifier === 'regex');

    expect(astResults).toHaveLength(5);
    expect(fsResults).toHaveLength(4);
    expect(regexResults).toHaveLength(1);
  });

  it('each result contains evidence of failures', () => {
    const ruleSet = buildRuleSet(rules);
    const results = verifyOutput(ruleSet, failingDir);

    for (const r of results) {
      if (!r.passed) {
        expect(r.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});

// -- Edge case: empty rule set --

describe('Verifier orchestrator: edge cases', () => {
  it('returns empty results for empty rule set', () => {
    const ruleSet = buildRuleSet([]);
    const results = verifyOutput(ruleSet, passingDir);
    expect(results).toHaveLength(0);
  });

  it('handles unknown verifier type gracefully', () => {
    const rule = makeRule('unknown-rule', 'naming', 'ast', 'unknown-pattern-type', '*', true);
    // Override verifier to something unknown to test fallback
    (rule as { verifier: string }).verifier = 'magic';
    const ruleSet = buildRuleSet([rule]);
    const results = verifyOutput(ruleSet, passingDir);
    expect(results).toHaveLength(1);
    // Unknown verifier returns a passing result (no check to run)
    expect(results[0]!.passed).toBe(true);
  });
});
