import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { discoverInstructionFiles } from '../../src/parsers/discover-instructions.js';
import { parseInstructionContent, parseInstructionFile } from '../../src/parsers/index.js';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import { emitEslintConfig } from '../../src/emitter/eslint.js';
import { resolveEslintConfigs } from '../../src/drift/resolve-eslint-config.js';
import { compareInstructionConfigs, compareResolvedConfigs } from '../../src/drift/compare-configs.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
function fixture() {
  const cwd = mkdtempSync(resolve('.scoped-instructions-'));
  directories.push(cwd);
  for (const dir of ['packages/api', 'packages/web', '.cursor/rules', '.github/instructions/backend', 'node_modules/vendor']) mkdirSync(resolve(cwd, dir), { recursive: true });
  writeFileSync(resolve(cwd, 'packages/api/AGENTS.md'), '- Never use var.');
  writeFileSync(resolve(cwd, '.cursor/rules/style.mdc'), '---\nglobs: "packages/web/**/*.{ts,tsx}"\nalwaysApply: false\n---\n- No enums.');
  writeFileSync(resolve(cwd, '.cursor/rules/conditional.mdc'), '---\ndescription: Consider for service code\nalwaysApply: false\n---\n- Never use any type.');
  writeFileSync(resolve(cwd, '.github/instructions/backend/types.instructions.md'), '---\napplyTo: "packages/api/**/*.ts"\n---\n- No non-null assertions.');
  writeFileSync(resolve(cwd, 'node_modules/vendor/AGENTS.md'), '- Never use var.');
  for (const name of ['packages/api/sample.ts', 'packages/web/sample.ts']) writeFileSync(resolve(cwd, name), 'var value = 1; enum Kind { A }');
  writeFileSync(resolve(cwd, 'eslint.config.mjs'), "import parser from '@typescript-eslint/parser'; export default [{ files: ['**/*.ts'], languageOptions: { parser }, rules: {} }];");
  return cwd;
}

describe('scoped instruction discovery and enforcement', () => {
  it('discovers nested AGENTS, Cursor and recursive Copilot instructions', () => {
    const cwd = fixture();
    expect(discoverInstructionFiles(cwd).map(file => relative(cwd, file))).toEqual([
      '.cursor/rules/conditional.mdc', '.cursor/rules/style.mdc', '.github/instructions/backend/types.instructions.md', 'packages/api/AGENTS.md',
    ]);
  });

  it('reports package requirements only for package source paths', async () => {
    const cwd = fixture();
    const configFile = resolve(cwd, 'eslint.config.mjs');
    const configs = await resolveEslintConfigs(configFile, { files: ['packages/api/sample.ts', 'packages/web/sample.ts'] });
    const md = mapRuleSetToEslintConfig(parseInstructionFile(resolve(cwd, 'packages/api/AGENTS.md')));
    const report = compareResolvedConfigs(md, configs, configFile);
    expect(report.items).toMatchObject([{ kind: 'md-only', ruleName: 'no-var', filePath: 'packages/api/sample.ts' }]);
    expect(report.coverage![0].files).toEqual(['packages/api/sample.ts']);
    expect(report.coverage![0].enforcedOnBothSides).toEqual([]);
  });

  it.each([
    ['packages/api/AGENTS.md', 'no-var', 'packages/api/sample.ts', 'packages/web/sample.ts'],
    ['.cursor/rules/style.mdc', 'no-restricted-syntax', 'packages/web/sample.ts', 'packages/api/sample.ts'],
    ['.github/instructions/backend/types.instructions.md', '@typescript-eslint/no-non-null-assertion', 'packages/api/sample.ts', 'packages/web/sample.ts'],
  ])('generated %s scope controls real ESLint', async (instruction, rule, failing, outside) => {
    const cwd = fixture();
    const md = mapRuleSetToEslintConfig(parseInstructionFile(resolve(cwd, instruction)));
    const configFile = resolve(cwd, 'generated.mjs');
    writeFileSync(configFile, emitEslintConfig(md, 'flat', cwd));
    for (const file of [failing, outside]) writeFileSync(resolve(cwd, file), 'var value = input!; enum Kind { A }');
    // A parser-only entry lets ESLint lint the out-of-scope TS file too.
    const wrapper = resolve(cwd, 'wrapper.mjs');
    writeFileSync(wrapper, "import parser from '@typescript-eslint/parser'; import rules from './generated.mjs'; export default [{ files: ['**/*.ts'], languageOptions: { parser } }, ...rules];");
    const eslint = new ESLint({ cwd, overrideConfigFile: wrapper });
    expect((await eslint.lintFiles([failing]))[0].messages.map(message => message.ruleId)).toEqual([rule]);
    expect((await eslint.lintFiles([outside]))[0].messages).toEqual([]);
    writeFileSync(resolve(cwd, failing), 'const value = 1;');
    expect((await eslint.lintFiles([failing]))[0].messages).toEqual([]);
  });

  it('keeps Cursor agent-selected rules conditional in combined coverage', async () => {
    const cwd = fixture();
    const configFile = resolve(cwd, 'eslint.config.mjs');
    const configs = await resolveEslintConfigs(configFile, { files: ['packages/api/sample.ts', 'packages/web/sample.ts'] });
    const instructions = discoverInstructionFiles(cwd).map(file => mapRuleSetToEslintConfig(parseInstructionFile(file)));
    const report = compareInstructionConfigs(instructions, configs, configFile, cwd);
    const conditional = report.coverage!.find(line => line.sourceFile?.endsWith('conditional.mdc'))!;
    expect(conditional).toMatchObject({ line: 5, status: 'conditional', files: [], enforcedOnBothSides: [], reason: expect.stringContaining('not always applied') });
    expect(report.items.some(item => item.ruleName === '@typescript-eslint/no-explicit-any')).toBe(false);
    const conditionalConfig = instructions.find(instruction => instruction.scope?.conditional)!;
    const generated = resolve(cwd, 'conditional.mjs');
    writeFileSync(generated, emitEslintConfig(conditionalConfig, 'flat', cwd));
    writeFileSync(resolve(cwd, 'sample.ts'), 'let value: any;');
    expect((await new ESLint({ cwd, overrideConfigFile: generated }).lintFiles(['sample.ts']))[0].messages).toEqual([]);
  });

  it('reads YAML lists and comma-separated patterns without splitting brace globs', () => {
    const cwd = fixture();
    const rules = parseInstructionContent('---\nglobs:\n  - "src/**/*.{ts,tsx}"\n  - "lib/**, tests/**"\n---\n- Never use var.', resolve(cwd, '.cursor/rules/list.mdc'));
    expect(rules.scope?.patterns).toEqual(['src/**/*.{ts,tsx}', 'lib/**', 'tests/**']);
    expect(rules.sourceLines).toEqual([{ line: 6, text: '- Never use var.' }]);
  });

  it('does not widen a sibling directory scope when choosing the fragment location', () => {
    const cwd = fixture();
    const md = mapRuleSetToEslintConfig(parseInstructionFile(resolve(cwd, 'packages/api/AGENTS.md')));
    expect(() => emitEslintConfig(md, 'flat', resolve(cwd, 'packages/web'))).toThrow(/scope root/);
    expect(() => emitEslintConfig(md, 'flat', resolve(cwd, 'packages/api/src'))).not.toThrow();
  });

  it('alwaysApply takes precedence over Cursor globs', () => {
    const cwd = fixture();
    const rules = parseInstructionContent('---\nalwaysApply: true\nglobs: "src/*.ts"\n---\n- Never use var.', resolve(cwd, '.cursor/rules/always.mdc'));
    expect(rules.scope).toMatchObject({ conditional: false, patterns: ['**/*'] });
  });

  it.each(['---\napplyTo: false\n---', '---\napplyTo: "**/*.ts"', '---\napplyTo: "**/*.ts"\napplyTo: "**/*.js"\n---'])('rejects invalid scope instead of widening it: %s', frontmatter => {
    expect(() => parseInstructionContent(frontmatter + '\n- Never use var.', '.github/instructions/invalid.instructions.md')).toThrow();
  });
});
