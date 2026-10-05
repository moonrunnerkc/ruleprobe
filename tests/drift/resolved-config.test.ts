import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEslintConfigs } from '../../src/drift/resolve-eslint-config.js';
import { compareResolvedConfigs } from '../../src/drift/compare-configs.js';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import { parseInstructionContent } from '../../src/parsers/index.js';
import { formatDriftReport } from '../../src/drift/format-drift-report.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
function fixture() {
  const cwd = mkdtempSync(resolve('.resolved-config-'));
  directories.push(cwd);
  for (const dir of ['src', 'tests']) {
    mkdirSync(resolve(cwd, dir));
    writeFileSync(resolve(cwd, dir, 'sample.ts'), 'var value = 1;');
  }
  const configFile = resolve(cwd, 'eslint.config.mjs');
  writeFileSync(configFile, `export default [
    { files: ['**/*.ts'], rules: { 'no-var': 'error' } },
    { files: ['tests/**'], rules: { 'no-var': 'off' } }
  ];`);
  return { cwd, configFile };
}
const expected = mapRuleSetToEslintConfig(parseInstructionContent('- Never use var.', 'AGENTS.md'));

describe('per-file drift', () => {
  it('resolves overrides with ESLint and lists checked paths', async () => {
    const { cwd, configFile } = fixture();
    const files = ['src/sample.ts', 'tests/sample.ts'];
    const configs = await resolveEslintConfigs(configFile, { files });
    const report = compareResolvedConfigs(expected, configs, configFile);
    expect(report.pathsChecked).toEqual(files);
    expect(report.items).toMatchObject([{ kind: 'md-only', ruleName: 'no-var', filePath: 'tests/sample.ts' }]);
    const eslint = new ESLint({ cwd, overrideConfigFile: configFile });
    const results = await eslint.lintFiles(files);
    expect(results[0].messages.map(message => message.ruleId)).toEqual(['no-var']);
    expect(results[1].messages).toEqual([]);
    expect(formatDriftReport(report)).toContain('src/sample.ts, tests/sample.ts');
  });

  it('labels static fallback and never flattens a scoped override', async () => {
    const { cwd } = fixture();
    const file = resolve(cwd, 'config.json');
    writeFileSync(file, JSON.stringify([{ rules: { 'no-var': 'error' } }, { files: ['tests/**'], rules: { 'no-var': 'off' } }]));
    const configs = await resolveEslintConfigs(file);
    expect(configs[0].rules).toMatchObject([{ ruleName: 'no-var', severity: 'error' }]);
    expect(configs[0].resolution).toBe('fallback');
    expect(formatDriftReport(compareResolvedConfigs(expected, configs, file))).toContain('Fallback:');
  });

  it('JSON mode reads snapshots without executing any repository config', async () => {
    const { cwd, configFile } = fixture();
    const marker = resolve(cwd, 'executed');
    const sideEffect = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'unsafe'); export default [];`;
    writeFileSync(configFile, sideEffect);
    writeFileSync(resolve(cwd, 'ruleprobe.config.js'), sideEffect);
    const snapshot = resolve(cwd, 'snapshot.json');
    writeFileSync(snapshot, JSON.stringify({ files: { 'src/sample.ts': { rules: { 'no-var': [2] } } } }));
    const configs = await resolveEslintConfigs(snapshot, { configJson: true });
    expect(configs[0]).toMatchObject({ filePath: 'src/sample.ts', resolution: 'json' });
    expect(compareResolvedConfigs(expected, configs, snapshot).hasDrift).toBe(false);
    await expect(resolveEslintConfigs(configFile, { configJson: true })).rejects.toThrow();
    expect(existsSync(marker)).toBe(false);
  });

  it('reports related naming rules only as partial matches', async () => {
    const { cwd } = fixture();
    const snapshot = resolve(cwd, 'snapshot.json');
    writeFileSync(snapshot, JSON.stringify({ files: { 'src/sample.ts': { rules: { camelcase: 'error' } } } }));
    const md = mapRuleSetToEslintConfig(parseInstructionContent('- Use camelCase for variables.', 'AGENTS.md'));
    const report = compareResolvedConfigs(md, await resolveEslintConfigs(snapshot, { configJson: true }), snapshot);
    expect(report.items).toContainEqual(expect.objectContaining({ kind: 'partial-match' }));
    expect(report.hasDrift).toBe(true);
  });
});
