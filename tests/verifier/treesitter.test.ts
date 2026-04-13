/**
 * Tests for tree-sitter multi-language verification.
 *
 * Validates Python and Go analysis via web-tree-sitter WASM grammars.
 * Covers: snake_case checks, PascalCase checks, Go naming, function length,
 * and the verifier routing logic.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  loadTreeSitter,
  parseWithTreeSitter,
  resolveWasmPath,
  isTreeSitterAvailable,
  detectLanguage,
  collectNodesByType,
} from '../../src/verifier/treesitter-loader.js';
import {
  checkPythonSnakeCase,
  checkPythonClassNaming,
  checkGoNaming,
  checkFunctionLength,
} from '../../src/verifier/treesitter-checks.js';
import { verifyTreeSitterRule } from '../../src/verifier/treesitter-verifier.js';
import type { Rule } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'sample-output');
const passingPython = resolve(fixturesDir, 'passing', 'src', 'utils.py');
const failingPython = resolve(fixturesDir, 'failing', 'src', 'bad_naming.py');
const passingGo = resolve(fixturesDir, 'passing', 'src', 'utils.go');

// ── Loader tests ──

describe('tree-sitter loader', () => {
  it('loads the tree-sitter module', async () => {
    const mod = await loadTreeSitter();
    expect(mod).not.toBeNull();
    expect(mod!.Parser).toBeDefined();
    expect(mod!.Language).toBeDefined();
  });

  it('resolves python WASM path', () => {
    const path = resolveWasmPath('python');
    expect(path).not.toBeNull();
    expect(path!.endsWith('.wasm')).toBe(true);
  });

  it('resolves go WASM path', () => {
    const path = resolveWasmPath('go');
    expect(path).not.toBeNull();
    expect(path!.endsWith('.wasm')).toBe(true);
  });

  it('reports availability for installed grammars', async () => {
    expect(await isTreeSitterAvailable('python')).toBe(true);
    expect(await isTreeSitterAvailable('go')).toBe(true);
  });

  it('detects language from file extension', () => {
    expect(detectLanguage('test.py')).toBe('python');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('file.ts')).toBeNull();
    expect(detectLanguage('file.rs')).toBeNull();
  });
});

// ── Python parsing and checks ──

describe('tree-sitter python checks', () => {
  it('parses a Python file and finds function definitions', async () => {
    const result = await parseWithTreeSitter(passingPython, 'python');
    expect(result).not.toBeNull();
    const funcs = collectNodesByType(result!.root, 'function_definition');
    expect(funcs.length).toBeGreaterThan(0);
    result!.tree.delete();
  });

  it('passing python has zero snake_case violations', async () => {
    const result = await parseWithTreeSitter(passingPython, 'python');
    expect(result).not.toBeNull();
    const evidence = checkPythonSnakeCase(result!.root, passingPython);
    expect(evidence).toHaveLength(0);
    result!.tree.delete();
  });

  it('failing python detects non-snake_case functions', async () => {
    const result = await parseWithTreeSitter(failingPython, 'python');
    expect(result).not.toBeNull();
    const evidence = checkPythonSnakeCase(result!.root, failingPython);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => e.found.includes('not snake_case'))).toBe(true);
    result!.tree.delete();
  });

  it('passing python has zero class naming violations', async () => {
    const result = await parseWithTreeSitter(passingPython, 'python');
    expect(result).not.toBeNull();
    const evidence = checkPythonClassNaming(result!.root, passingPython);
    expect(evidence).toHaveLength(0);
    result!.tree.delete();
  });

  it('failing python detects non-PascalCase classes', async () => {
    const result = await parseWithTreeSitter(failingPython, 'python');
    expect(result).not.toBeNull();
    const evidence = checkPythonClassNaming(result!.root, failingPython);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => e.found.includes('not PascalCase'))).toBe(true);
    result!.tree.delete();
  });
});

// ── Go parsing and checks ──

describe('tree-sitter go checks', () => {
  it('parses a Go file and finds function declarations', async () => {
    const result = await parseWithTreeSitter(passingGo, 'go');
    expect(result).not.toBeNull();
    const funcs = collectNodesByType(result!.root, 'function_declaration');
    expect(funcs.length).toBeGreaterThan(0);
    result!.tree.delete();
  });

  it('passing go has zero naming violations', async () => {
    const result = await parseWithTreeSitter(passingGo, 'go');
    expect(result).not.toBeNull();
    const evidence = checkGoNaming(result!.root, passingGo);
    expect(evidence).toHaveLength(0);
    result!.tree.delete();
  });
});

// ── Function length check ──

describe('tree-sitter function length', () => {
  it('short python functions pass length check', async () => {
    const result = await parseWithTreeSitter(passingPython, 'python');
    expect(result).not.toBeNull();
    const evidence = checkFunctionLength(
      result!.root, passingPython, 50, ['function_definition'],
    );
    expect(evidence).toHaveLength(0);
    result!.tree.delete();
  });

  it('detects python functions exceeding length limit', async () => {
    const result = await parseWithTreeSitter(passingPython, 'python');
    expect(result).not.toBeNull();
    // Set an extremely low limit to trigger violations
    const evidence = checkFunctionLength(
      result!.root, passingPython, 1, ['function_definition'],
    );
    expect(evidence.length).toBeGreaterThan(0);
    result!.tree.delete();
  });
});

// ── Verifier integration ──

describe('verifyTreeSitterRule', () => {
  function makeRule(patternType: string, target: string, expected: string | boolean): Rule {
    return {
      id: `test-${patternType}`,
      description: `Test ${patternType}`,
      category: 'naming',
      severity: 'error',
      verifier: 'treesitter',
      pattern: { type: patternType, target, expected, scope: 'file' },
      source: 'test',
    };
  }

  it('processes python-snake-case rule on passing files', async () => {
    const rule = makeRule('python-snake-case', 'python', 'snake_case');
    const result = await verifyTreeSitterRule(rule, [passingPython]);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveLength(0);
  });

  it('processes python-snake-case rule on failing files', async () => {
    const rule = makeRule('python-snake-case', 'python', 'snake_case');
    const result = await verifyTreeSitterRule(rule, [failingPython]);
    expect(result.passed).toBe(false);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('processes go-naming rule on passing files', async () => {
    const rule = makeRule('go-naming', 'go', 'conventions');
    const result = await verifyTreeSitterRule(rule, [passingGo]);
    expect(result.passed).toBe(true);
  });

  it('passes when no files match the target language', async () => {
    const rule = makeRule('go-naming', 'go', 'conventions');
    const result = await verifyTreeSitterRule(rule, [passingPython]);
    expect(result.passed).toBe(true);
  });

  it('processes function-length rule', async () => {
    const rule = makeRule('function-length', 'python', '50');
    const result = await verifyTreeSitterRule(rule, [passingPython]);
    expect(result.passed).toBe(true);
  });
});
