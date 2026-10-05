import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';

const root = resolve(import.meta.dirname, '../..');
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
function fixture() {
  const cwd = mkdtempSync(resolve(root, '.drift-cli-'));
  directories.push(cwd);
  writeFileSync(resolve(cwd, 'AGENTS.md'), '- Never use var.');
  writeFileSync(resolve(cwd, 'sample.ts'), 'var value = 1;');
  return cwd;
}
function run(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(root, 'src/cli.ts'), ...args], { cwd, encoding: 'utf8', timeout: 30_000 });
  if (result.error) throw result.error;
  return result;
}

describe('owned fragment regeneration', () => {
  it('previews without writes and preserves the hand-written config byte-for-byte', async () => {
    const cwd = fixture();
    const configFile = resolve(cwd, 'eslint.config.mjs');
    const handwritten = "// Hand-written settings\r\nimport fragment from './eslint.ruleprobe.mjs';\r\nexport default [{ rules: { 'no-debugger': 'error' } }, ...fragment];\r\n";
    writeFileSync(configFile, handwritten);
    const args = ['lint-config', 'AGENTS.md', '--output', 'eslint.ruleprobe.mjs'];
    const preview = run(cwd, [...args, '--preview']);
    expect(preview.status, preview.stderr).toBe(0);
    expect(existsSync(resolve(cwd, 'eslint.ruleprobe.mjs'))).toBe(false);
    expect(readFileSync(configFile, 'utf8')).toBe(handwritten);
    const generated = run(cwd, args);
    expect(generated.status, generated.stderr).toBe(0);
    expect(readFileSync(resolve(cwd, 'eslint.ruleprobe.mjs'), 'utf8')).toBe(preview.stdout.trimEnd());
    writeFileSync(resolve(cwd, 'AGENTS.md'), '- Never use var.\n- No enums.');
    const regenerated = run(cwd, args);
    expect(regenerated.status, regenerated.stderr).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(handwritten);
    writeFileSync(resolve(cwd, 'sample.ts'), 'var value = 1; enum Kind { A }');
    const eslint = new ESLint({ cwd, overrideConfigFile: configFile });
    expect((await eslint.lintFiles(['sample.ts']))[0].messages.map(message => message.ruleId)).toEqual(['no-var', 'no-restricted-syntax']);
  }, 15_000);

  it('refuses to overwrite an unowned output', () => {
    const cwd = fixture();
    const configFile = resolve(cwd, 'eslint.config.mjs');
    const original = 'export default [{ rules: { "no-debugger": "error" } }];\n';
    writeFileSync(configFile, original);
    const result = run(cwd, ['lint-config', 'AGENTS.md', '--output', 'eslint.config.mjs']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('not a RuleProbe-owned fragment');
    expect(readFileSync(configFile, 'utf8')).toBe(original);
  });
});

describe('CI drift exits', () => {
  it.each([
    [{}, 1, true],
    [{ 'no-var': 'error', 'no-debugger': 'error' }, 0, false],
  ])('checks required enforcement with config %j', async (rules, exitCode, hasDrift) => {
    const cwd = fixture();
    const configFile = resolve(cwd, 'eslint.config.mjs');
    writeFileSync(configFile, `export default [{ files: ['**/*.ts'], rules: ${JSON.stringify(rules)} }];`);
    const result = run(cwd, ['drift', 'AGENTS.md', 'eslint.config.mjs', '--files', 'sample.ts', '--format', 'json']);
    expect(result.status, result.stderr).toBe(exitCode);
    const report = JSON.parse(result.stdout);
    expect(report.hasDrift).toBe(hasDrift);
    if (!hasDrift) expect(report.items).toContainEqual(expect.objectContaining({ kind: 'eslint-only', ruleName: 'no-debugger' }));
    const eslint = new ESLint({ cwd, overrideConfigFile: configFile });
    const messages = (await eslint.lintFiles(['sample.ts']))[0].messages;
    expect(messages.map(message => message.ruleId)).toEqual(hasDrift ? [] : ['no-var']);
  });

  it('checks discovered instructions with their own scopes', () => {
    const cwd = fixture();
    mkdirSync(resolve(cwd, 'packages/api'), { recursive: true });
    mkdirSync(resolve(cwd, '.cursor/rules'), { recursive: true });
    writeFileSync(resolve(cwd, 'AGENTS.md'), '# Root instructions');
    writeFileSync(resolve(cwd, 'packages/api/AGENTS.md'), '- Never use var.');
    writeFileSync(resolve(cwd, 'packages/api/value.ts'), 'var value = 1;');
    writeFileSync(resolve(cwd, '.cursor/rules/service.mdc'), '---\nalwaysApply: false\n---\n- Never use any type.');
    writeFileSync(resolve(cwd, 'eslint.config.mjs'), "export default [{ files: ['**/*.ts'], rules: {} }];");
    const result = run(cwd, ['drift', '.', 'eslint.config.mjs', '--format', 'json', '--files', 'sample.ts', 'packages/api/value.ts']);
    expect(result.status, result.stderr).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.items).toMatchObject([{ kind: 'md-only', ruleName: 'no-var', filePath: 'packages/api/value.ts' }]);
    expect(report.coverage).toContainEqual(expect.objectContaining({ status: 'conditional', enforcedOnBothSides: [] }));
  });

  it('fails rather than certifying an empty comparison', () => {
    const cwd = fixture();
    writeFileSync(resolve(cwd, 'AGENTS.md'), '# Rules\n');
    writeFileSync(resolve(cwd, 'eslint.config.mjs'), 'export default [];');
    const result = run(cwd, ['drift', 'AGENTS.md', 'eslint.config.mjs', '--format', 'json', '--files', 'sample.ts']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ comparisonStatus: 'nothing-compared', hasDrift: false, coverage: [] });
  });
});
