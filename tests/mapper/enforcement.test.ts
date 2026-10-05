import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import { emitEslintConfig } from '../../src/emitter/eslint.js';
import type { RuleSet } from '../../src/types.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

function ruleSet(types: string[], expected: string | boolean = true): RuleSet {
  return {
    sourceFile: 'AGENTS.md', sourceType: 'agents.md', unparseable: [],
    rules: types.map((type, index) => ({
      id: `${type}-${index}`, source: type, description: type, category: 'code-style',
      severity: 'error', verifier: 'ast',
      pattern: { type, expected, target: '*.ts', scope: 'file' },
    })),
  };
}

async function lint(types: string[], code: string, expected: string | boolean = true, filename = 'sample-file.ts') {
  const dir = mkdtempSync(resolve('.enforcement-'));
  directories.push(dir);
  const config = mapRuleSetToEslintConfig(ruleSet(types, expected));
  writeFileSync(resolve(dir, 'eslint.config.mjs'), emitEslintConfig(config));
  writeFileSync(resolve(dir, filename), code);
  const eslint = new ESLint({ cwd: dir, overrideConfigFile: resolve(dir, 'eslint.config.mjs') });
  const [result] = await eslint.lintFiles([filename]);
  return result.messages;
}

const samples: Array<[string, string, string, string, (string | boolean)?]> = [
  ['no-any', '@typescript-eslint/no-explicit-any', 'let value: unknown;', 'let value: any;'],
  ['named-exports-only', 'import/no-default-export', 'export const value = 1;', 'export default 1;'],
  ['no-console-log', 'no-restricted-syntax', 'console.warn("x");', 'console.log("x");'],
  ['no-console-extended', 'no-console', 'logger.log("x");', 'console.warn("x");'],
  ['no-var', 'no-var', 'let value = 1;', 'var value = 1;'],
  ['prefer-const', 'prefer-const', 'const value = 1;', 'let value = 1;'],
  ['no-else-after-return', 'no-else-return', 'function f(x) { if (x) return 1; return 2; }', 'function f(x) { if (x) return 1; else return 2; }'],
  ['no-nested-ternary', 'no-nested-ternary', 'const x = a ? b : c;', 'const x = a ? b : c ? d : e;'],
  ['no-magic-numbers', 'no-magic-numbers', 'const limit = 42; f(limit);', 'f(42);'],
  ['no-empty-catch', 'no-empty', 'try { f(); } catch (e) { throw e; }', 'try { f(); } catch (e) {}'],
  ['no-enum', 'no-restricted-syntax', 'type Value = "a";', 'enum Value { A }'],
  ['no-type-assertions', '@typescript-eslint/consistent-type-assertions', 'const value: string = "x";', 'const value = input as string;'],
  ['no-non-null-assertions', '@typescript-eslint/no-non-null-assertion', 'value?.f();', 'value!.f();'],
  ['no-ts-directives', '@typescript-eslint/ban-ts-comment', '// @ts-check\nconst x = 1;', '// @ts-expect-error: explanation\nconst x = 1;'],
  ['max-function-length', 'max-lines-per-function', 'function f() { return 1; }', 'function f() {\n f();\n f();\n}', '2'],
  ['max-params', 'max-params', 'function f(a) {}', 'function f(a,b,c) {}', '2'],
  ['max-file-length', 'max-lines', 'f();', 'f();\nf();\nf();', '2'],
  ['max-line-length', 'max-len', 'f();', 'const longValue = "a long string";', '20'],
  ['no-wildcard-exports', 'no-restricted-syntax', 'export { value } from "./value";', 'export * from "./value";'],
  ['no-namespace-imports', 'import/no-namespace', 'import { value } from "./value";', 'import * as value from "./value";'],
  ['no-path-aliases', 'no-restricted-imports', 'import value from "./value";', 'import value from "@app/value";'],
  ['no-deep-relative-imports', 'no-restricted-syntax', 'import value from "../../value";', 'import value from "../../../value";', '2'],
  ['jsdoc-required', 'jsdoc/require-jsdoc', '/** Return a value. */\nexport function f() { return 1; }', 'export function f() { return 1; }'],
  ['no-todo-comments', 'no-warning-comments', '// finished\nf();', '// later: TODO fix this\nf();'],
  ['PascalCase', '@typescript-eslint/naming-convention', 'class GoodName {}', 'class bad_name {}'],
  ['camelCase', '@typescript-eslint/naming-convention', 'let goodName;', 'let bad_name;'],
  ['UPPER_CASE', '@typescript-eslint/naming-convention', 'const GOOD_NAME = 1;', 'const badName = 1;'],
  ['consistent-semicolons', 'semi', 'f();', 'f()', 'always'],
  ['consistent-semicolons', 'semi', 'f()', 'f();', 'never'],
  ['quote-style', 'quotes', "const x = 'hello';", 'const x = "hello";', 'single'],
  ['quote-style', 'quotes', 'const x = "hello";', "const x = 'hello';", 'double'],
];

describe('generated configs enforce instructions on real files', () => {
  it.each(samples)('%s (%s)', async (type, rule, passing, failing, expected = true) => {
    expect(await lint([type], passing, expected)).toEqual([]);
    expect((await lint([type], failing, expected)).map(message => message.ruleId)).toContain(rule);
  });

  it.each(['no-implicit-any', 'no-unused-exports', 'throw-error-only'])('reports %s as unsupported', type => {
    const config = mapRuleSetToEslintConfig(ruleSet([type]));
    expect(config.rules).toEqual([]);
    expect(config.unmappable[0].reason).toMatch(/Requires/);
  });

  it('checks filenames', async () => {
    expect(await lint(['kebab-case'], 'export {};')).toEqual([]);
    expect((await lint(['kebab-case'], 'export {};', true, 'BadName.ts')).map(m => m.ruleId)).toContain('unicorn/filename-case');
  });

  it('merges selectors and naming constraints without losing enforcement', async () => {
    expect((await lint(['no-enum', 'no-wildcard-exports'], 'enum X { A }\nexport * from "./x";')).map(m => m.ruleId)).toEqual(['no-restricted-syntax', 'no-restricted-syntax']);
    expect((await lint(['PascalCase', 'camelCase'], 'class bad_name {}\nlet bad_name;')).map(m => m.ruleId)).toEqual(['@typescript-eslint/naming-convention', '@typescript-eslint/naming-convention']);
  });

  it('does not emit duplicate console entries', async () => {
    const config = mapRuleSetToEslintConfig(ruleSet(['no-console-extended', 'no-console-extended']));
    expect(config.rules).toHaveLength(1);
    expect((await lint(['no-console-log', 'no-console-extended'], 'console.warn("x");')).map(m => m.ruleId)).toContain('no-console');
  });
});
