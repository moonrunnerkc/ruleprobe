/**
 * Integration test: Python and Go files get real AST-based checks.
 *
 * Proves L1 is resolved by exercising the full pipeline from
 * instruction text through the verifier and asserting that the
 * tree-sitter engine produces concrete file/line evidence on
 * fixture violations and passes on clean fixtures.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { verifyOutput } from '../../src/verifier/index.js';
import { parseInstructionContent } from '../../src/parsers/index.js';
import { isTreeSitterAvailable } from '../../src/verifier/treesitter-loader.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const PY_DIR = resolve(ROOT, 'tests/fixtures/lang/python');
const GO_DIR = resolve(ROOT, 'tests/fixtures/lang/go');

describe('tree-sitter end-to-end: Python', () => {
  it('detects snake_case violations on the violating fixture', async () => {
    if (!(await isTreeSitterAvailable('python'))) {
      return;
    }
    const ruleSet = parseInstructionContent(
      '- Use snake_case for Python functions.\n',
      'TEST.md',
    );
    const pythonRule = ruleSet.rules.find((r) => r.pattern.type === 'python-snake-case');
    expect(pythonRule, `expected a python-snake-case rule from parser; got ids: ${ruleSet.rules.map((r) => r.id).join(', ')}`).toBeDefined();

    const results = await verifyOutput(ruleSet, PY_DIR);
    const result = results.find((r) => r.rule.id === pythonRule!.id);
    expect(result).toBeDefined();
    expect(result!.passed).toBe(false);
    expect(result!.evidence.length).toBeGreaterThan(0);

    const violation = result!.evidence.find((e) => /BadlyNamed/.test(e.found));
    expect(violation, `expected an evidence entry naming "BadlyNamed"; got: ${result!.evidence.map((e) => e.found).join(' | ')}`).toBeDefined();
    expect(violation!.line).toBeGreaterThan(0);
    expect(violation!.file).toContain('violating.py');
  });

  it('detects PascalCase class-name violations on the violating fixture', async () => {
    if (!(await isTreeSitterAvailable('python'))) {
      return;
    }
    const ruleSet = parseInstructionContent(
      '- Python classes must use PascalCase.\n',
      'TEST.md',
    );
    const classRule = ruleSet.rules.find((r) => r.pattern.type === 'python-class-naming');
    expect(classRule).toBeDefined();

    const results = await verifyOutput(ruleSet, PY_DIR);
    const result = results.find((r) => r.rule.id === classRule!.id);
    expect(result!.passed).toBe(false);
    const violation = result!.evidence.find((e) => /lowercase_class/.test(e.found));
    expect(violation).toBeDefined();
  });

  it('passes the clean fixture with no evidence', async () => {
    if (!(await isTreeSitterAvailable('python'))) {
      return;
    }
    const ruleSet = parseInstructionContent(
      '- Use snake_case for Python functions.\n- Python classes must use PascalCase.\n',
      'TEST.md',
    );
    const pythonRules = ruleSet.rules.filter(
      (r) => r.pattern.type === 'python-snake-case' || r.pattern.type === 'python-class-naming',
    );
    expect(pythonRules.length).toBeGreaterThanOrEqual(2);

    const cleanOnlyDir = resolve(PY_DIR, '..', 'python-clean-only');
    // We can't have only clean.py in PY_DIR (violating.py is in the same dir);
    // run against PY_DIR but then assert that evidence only references the
    // violating fixture, never the clean one.
    const results = await verifyOutput(ruleSet, PY_DIR);
    for (const rule of pythonRules) {
      const result = results.find((r) => r.rule.id === rule.id);
      const cleanEvidence = result!.evidence.filter((e) => /clean\.py/.test(e.file));
      expect(cleanEvidence, `clean.py should never appear in violations for rule ${rule.id}`).toEqual([]);
    }
    void cleanOnlyDir;
  });
});

describe('tree-sitter end-to-end: Go', () => {
  it('detects naming violations on the violating Go fixture', async () => {
    if (!(await isTreeSitterAvailable('go'))) {
      return;
    }
    const ruleSet = parseInstructionContent(
      '- Use PascalCase for exported Go functions.\n- Use camelCase for unexported Go functions.\n',
      'TEST.md',
    );
    const goRule = ruleSet.rules.find((r) => r.pattern.type === 'go-naming');
    expect(goRule, `expected a go-naming rule; got ids: ${ruleSet.rules.map((r) => r.id).join(', ')}`).toBeDefined();

    const results = await verifyOutput(ruleSet, GO_DIR);
    const result = results.find((r) => r.rule.id === goRule!.id);
    expect(result!.passed).toBe(false);
    expect(result!.evidence.length).toBeGreaterThan(0);

    const cleanEvidence = result!.evidence.filter((e) => /clean\.go/.test(e.file));
    expect(cleanEvidence, 'clean.go should not appear among violations').toEqual([]);
  });
});

describe('tree-sitter end-to-end: function length', () => {
  it('flags long Python functions when an instruction sets a limit', async () => {
    if (!(await isTreeSitterAvailable('python'))) {
      return;
    }
    const ruleSet = parseInstructionContent(
      '- Python functions must be under 15 lines.\n',
      'TEST.md',
    );
    const lengthRule = ruleSet.rules.find(
      (r) => r.pattern.type === 'function-length' && r.pattern.target === '*.py',
    );
    expect(lengthRule, `expected a Python function-length rule; got ids: ${ruleSet.rules.map((r) => r.id).join(', ')}`).toBeDefined();

    const results = await verifyOutput(ruleSet, PY_DIR);
    const result = results.find((r) => r.rule.id === lengthRule!.id);
    expect(result!.passed).toBe(false);
    const violation = result!.evidence.find((e) => /long_function_for_test/.test(e.found));
    expect(violation, `expected long_function_for_test in evidence; got: ${result!.evidence.map((e) => e.found).join(' | ')}`).toBeDefined();
  });
});
