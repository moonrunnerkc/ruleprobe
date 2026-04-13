/**
 * Tests for multi-file project analysis.
 *
 * Uses real temp directories with instruction files to verify
 * discovery, conflict detection, and redundancy detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeProject,
  discoverInstructionFiles,
} from '../../src/analyzers/project-analyzer.js';

let tempDir: string;

function setup(): string {
  const dir = join(tmpdir(), `ruleprobe-analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('discoverInstructionFiles', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('finds CLAUDE.md at project root', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Rules\n- Use camelCase');
    const files = discoverInstructionFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('CLAUDE.md');
  });

  it('finds multiple instruction files', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Rules\n- Use camelCase');
    writeFileSync(join(tempDir, 'AGENTS.md'), '# Rules\n- No console.log');
    const files = discoverInstructionFiles(tempDir);
    expect(files).toHaveLength(2);
  });

  it('finds .github/copilot-instructions.md', () => {
    mkdirSync(join(tempDir, '.github'), { recursive: true });
    writeFileSync(join(tempDir, '.github', 'copilot-instructions.md'), '# Rules');
    const files = discoverInstructionFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('copilot-instructions.md');
  });

  it('returns empty array when no instruction files exist', () => {
    const files = discoverInstructionFiles(tempDir);
    expect(files).toHaveLength(0);
  });
});

describe('analyzeProject', () => {
  beforeEach(() => { tempDir = setup(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('returns empty analysis when no instruction files found', () => {
    const result = analyzeProject(tempDir);
    expect(result.files).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.redundancies).toHaveLength(0);
    expect(result.summary.totalRules).toBe(0);
  });

  it('parses rules from discovered instruction files', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Naming\n- Use camelCase for variables');
    const result = analyzeProject(tempDir);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.ruleSet.rules.length).toBeGreaterThan(0);
  });

  it('detects redundant rules across files', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Rules\n- Use camelCase for variables');
    writeFileSync(join(tempDir, 'AGENTS.md'), '# Rules\n- Use camelCase for variables');
    const result = analyzeProject(tempDir);
    expect(result.files).toHaveLength(2);
    expect(result.redundancies.length).toBeGreaterThan(0);
  });

  it('detects conflicting rules across files', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Tooling\n- Use pnpm, not npm');
    writeFileSync(join(tempDir, 'AGENTS.md'), '# Tooling\n- Use yarn, not npm');
    const result = analyzeProject(tempDir);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0]!.topic).toBe('package-manager');
  });

  it('builds coverage map by category', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Rules\n- Use camelCase for variables\n- No console.log');
    const result = analyzeProject(tempDir);
    const namingFiles = result.coverageMap['naming'];
    expect(namingFiles).toBeDefined();
    expect(namingFiles!.length).toBeGreaterThan(0);
  });

  it('aggregates total rule count in summary', () => {
    writeFileSync(join(tempDir, 'CLAUDE.md'), '# Rules\n- Use camelCase for variables');
    writeFileSync(join(tempDir, 'AGENTS.md'), '# Rules\n- No console.log');
    const result = analyzeProject(tempDir);
    expect(result.summary.totalRules).toBeGreaterThan(0);
  });

  it('sets projectDir in result', () => {
    const result = analyzeProject(tempDir);
    expect(result.projectDir).toBe(tempDir);
  });
});
