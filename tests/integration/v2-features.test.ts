/**
 * Integration tests for v2.0.0 features.
 *
 * Tests the full pipeline: extract new matcher types from instruction
 * content, verify against realistic output, and produce reports
 * in the new formats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseInstructionFile } from '../../src/parsers/index.js';
import { verifyOutput } from '../../src/verifier/index.js';
import { formatReport } from '../../src/reporter/index.js';
import { generateReport } from '../../src/index.js';
import { analyzeProject } from '../../src/analyzers/project-analyzer.js';
import type { AgentRun } from '../../src/types.js';

let tempDir: string;
let outputDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-v2-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('v2 integration: multi-file analysis', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('discovers multiple instruction files and reports conflicts', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), [
      '# Rules',
      '- Use camelCase for variables',
      '- Maximum line length: 80 characters',
    ].join('\n'));

    writeFileSync(join(tempDir, 'AGENTS.md'), [
      '# Rules',
      '- Use camelCase for variables',
      '- Maximum line length: 120 characters',
    ].join('\n'));

    const analysis = analyzeProject(tempDir);
    expect(analysis.files).toHaveLength(2);
    expect(analysis.conflicts.length).toBeGreaterThan(0);
    expect(analysis.redundancies.length).toBeGreaterThan(0);
  });
});

describe('v2 integration: new report formats', () => {
  beforeEach(() => {
    tempDir = setup();
    outputDir = join(tempDir, 'output');
    mkdirSync(outputDir, { recursive: true });
  });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('produces valid summary, detailed, and ci format reports', async () => {
    const instructionFile = join(tempDir, 'CLAUDE.md');
    writeFileSync(instructionFile, [
      '# Rules',
      '- Use camelCase for variables',
      '- No console.log',
    ].join('\n'));
    writeFileSync(join(outputDir, 'app.ts'), 'export const myVar = 1;');

    const ruleSet = parseInstructionFile(instructionFile);
    const results = await verifyOutput(ruleSet, outputDir, { allowSymlinks: false });

    const run: AgentRun = {
      agent: 'test',
      model: 'test',
      task: 'manual',
      timestamp: new Date().toISOString(),
    };

    const report = generateReport(run, ruleSet, results);

    const summary = formatReport(report, 'summary');
    expect(summary).toContain('RuleProbe Summary');
    expect(summary).toContain('OVERALL');

    const detailed = formatReport(report, 'detailed');
    expect(detailed).toContain('Detailed');

    const ci = formatReport(report, 'ci');
    expect(ci).toContain('score=');
    expect(ci).toContain('status=');
  });
});

describe('v2 integration: qualifier detection', () => {
  beforeEach(() => {
    tempDir = setup();
  });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('attaches qualifiers to extracted rules', () => {
    const instructionFile = join(tempDir, 'CLAUDE.md');
    writeFileSync(instructionFile, [
      '# Naming',
      '- Always use camelCase for variables',
      '- Never use console.log',
      '- Prefer const over let',
    ].join('\n'));

    const ruleSet = parseInstructionFile(instructionFile);
    const alwaysRule = ruleSet.rules.find((r) => r.source.includes('Always'));
    const neverRule = ruleSet.rules.find((r) => r.source.includes('Never'));
    const preferRule = ruleSet.rules.find((r) => r.source.includes('Prefer'));

    expect(alwaysRule?.qualifier).toBe('always');
    expect(neverRule?.qualifier).toBe('never');
    expect(preferRule?.qualifier).toBe('prefer');
  });

  it('attaches section context to rules', () => {
    const instructionFile = join(tempDir, 'CLAUDE.md');
    writeFileSync(instructionFile, [
      '## Naming Conventions',
      '- Use camelCase for variables',
      '## Error Handling',
      '- No empty catch blocks',
    ].join('\n'));

    const ruleSet = parseInstructionFile(instructionFile);
    const namingRule = ruleSet.rules.find((r) => r.source.includes('camelCase'));
    const errorRule = ruleSet.rules.find((r) => r.source.includes('catch'));

    expect(namingRule?.section).toBe('Naming Conventions');
    expect(errorRule?.section).toBe('Error Handling');
  });
});
