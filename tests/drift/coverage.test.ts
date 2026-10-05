import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInstructionFile } from '../../src/parsers/index.js';
import { mapRuleSetToEslintConfig } from '../../src/mapper/index.js';
import { emitEslintConfig } from '../../src/emitter/eslint.js';
import { resolveEslintConfigs } from '../../src/drift/resolve-eslint-config.js';
import { compareResolvedConfigs } from '../../src/drift/compare-configs.js';
import { formatDriftReport } from '../../src/drift/format-drift-report.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

async function report(name: string) {
  const md = mapRuleSetToEslintConfig(parseInstructionFile(resolve('tests/drift/fixtures/instruction-coverage', `${name}.md`)));
  const cwd = mkdtempSync(resolve('.coverage-test-'));
  directories.push(cwd);
  const configFile = resolve(cwd, 'eslint.config.mjs');
  writeFileSync(configFile, emitEslintConfig(md));
  writeFileSync(resolve(cwd, 'sample.ts'), 'const value: unknown = 1;');
  const eslint = new ESLint({ cwd, overrideConfigFile: configFile });
  expect((await eslint.lintFiles(['sample.ts']))[0].messages).toEqual([]);
  return compareResolvedConfigs(md, await resolveEslintConfigs(configFile, { files: ['sample.ts'] }), configFile);
}

describe('instruction coverage', () => {
  it('distinguishes an empty comparison from no drift in human and JSON output', async () => {
    const result = await report('empty');
    expect(result.coverage).toEqual([]);
    expect(result.hasDrift).toBe(false);
    expect(result.comparisonStatus).toBe('nothing-compared');
    expect(formatDriftReport(result)).toContain('Nothing compared');
    expect(JSON.parse(formatDriftReport(result, 'json')).comparisonStatus).toBe('nothing-compared');
  });

  it('records fully translated lines and resolved enforcement', async () => {
    const result = await report('translated');
    expect(result.comparisonStatus).toBe('compared');
    expect(result.coverage).toEqual([
      { sourceFile: resolve('tests/drift/fixtures/instruction-coverage/translated.md'), line: 2, text: '- Never use var.', status: 'translated', files: ['sample.ts'], ruleNames: ['no-var'], enforcedOnBothSides: ['sample.ts'] },
      { sourceFile: resolve('tests/drift/fixtures/instruction-coverage/translated.md'), line: 3, text: '- Never use any type.', status: 'translated', files: ['sample.ts'], ruleNames: ['@typescript-eslint/no-explicit-any'], enforcedOnBothSides: ['sample.ts'] },
    ]);
  });

  it('records unsupported lines, compiler requirements and inferred proxies honestly', async () => {
    const result = await report('unsupported');
    expect(result.coverage).toHaveLength(4);
    expect(result.coverage![0]).toMatchObject({ line: 2, status: 'translated', enforcedOnBothSides: ['sample.ts'] });
    expect(result.coverage![1]).toMatchObject({ line: 3, text: '- Review changes with a teammate.', status: 'unsupported', reason: expect.stringContaining('No complete ESLint translation'), enforcedOnBothSides: [] });
    expect(result.coverage![2]).toMatchObject({ line: 4, status: 'unsupported', reason: expect.stringContaining('noImplicitAny'), enforcedOnBothSides: [] });
    expect(result.coverage![3]).toMatchObject({ line: 5, status: 'unsupported', enforcedOnBothSides: [] });
  });

  it('does not count static fallback as enforced on both sides', () => {
    const md = mapRuleSetToEslintConfig(parseInstructionFile(resolve('tests/drift/fixtures/instruction-coverage/translated.md')));
    const result = compareResolvedConfigs(md, [{ rules: md.rules.map(rule => ({ ...rule, options: rule.options ?? [] })), sourceFile: 'config.json', resolution: 'fallback' }], 'config.json');
    expect(result.comparisonStatus).toBe('fallback');
    expect(result.coverage!.every(line => line.enforcedOnBothSides.length === 0)).toBe(true);
  });
});
