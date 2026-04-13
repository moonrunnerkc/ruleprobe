/**
 * Tests for semantic analysis audit logging.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeAuditLog, formatAuditLog } from '../../src/semantic/audit-log.js';
import type { SemanticPipelineResult } from '../../src/semantic/index.js';

function makePipelineResult(overrides?: Partial<SemanticPipelineResult>): SemanticPipelineResult {
  return {
    performed: true,
    verdicts: [
      {
        ruleId: 'r1',
        compliance: 0.9,
        method: 'structural-fast-path',
        violations: [],
        mitigations: [],
        profileHash: 'abc123',
        tokenCost: 0,
      },
    ],
    sentPayload: {
      fileVectors: {
        '0': { nodeTypeCounts: { function_declaration: 5 }, nestingDepths: {}, subTreeHashes: [] },
      },
      rules: [
        { ruleId: 'r1', ruleText: 'Use functional components', qualifier: 'prefer', confidence: 0.9 },
      ],
      extractionHash: 'hash123',
    },
    report: {
      rulesAnalyzed: 1,
      fastPathResolutions: 1,
      llmResolutions: 0,
      unresolvedRules: 0,
      totalTokenCost: 0,
      verdicts: [],
      profile: {
        profileId: 'test',
        generatedAt: '2026-01-01T00:00:00Z',
        featureVectors: new Map(),
        crossFileGraph: { edges: new Map() },
        sampleSize: 1,
      },
      profileCacheHit: false,
      fastPathThreshold: 0.85,
      crossFileFindings: [],
    },
    ...overrides,
  };
}

describe('writeAuditLog', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates the .ruleprobe/semantic-log directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-audit-'));
    const result = makePipelineResult();
    writeAuditLog(tempDir, result);

    const logDir = join(tempDir, '.ruleprobe/semantic-log');
    expect(existsSync(logDir)).toBe(true);
  });

  it('writes a JSON log file with a timestamp-based name', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-audit-'));
    writeAuditLog(tempDir, makePipelineResult());

    const logDir = join(tempDir, '.ruleprobe/semantic-log');
    const files = readdirSync(logDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.json$/);
  });

  it('log file contains expected audit fields', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-audit-'));
    const logPath = writeAuditLog(tempDir, makePipelineResult());

    const content = JSON.parse(readFileSync(logPath, 'utf-8'));
    expect(content.performed).toBe(true);
    expect(content.verdictsCount).toBe(1);
    expect(content.sentPayload.fileVectorCount).toBe(1);
    expect(content.sentPayload.rulesCount).toBe(1);
    expect(content.sentPayload.extractionHash).toBe('hash123');
    expect(content.report.fastPathResolutions).toBe(1);
    expect(content.report.totalTokenCost).toBe(0);
  });

  it('logs skipped analysis with skip reason', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-audit-'));
    const result = makePipelineResult({
      performed: false,
      skipReason: 'License invalid',
      verdicts: [],
      report: undefined,
    });
    const logPath = writeAuditLog(tempDir, result);

    const content = JSON.parse(readFileSync(logPath, 'utf-8'));
    expect(content.performed).toBe(false);
    expect(content.skipReason).toBe('License invalid');
  });

  it('returns the absolute path to the log file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ruleprobe-audit-'));
    const logPath = writeAuditLog(tempDir, makePipelineResult());
    expect(logPath).toContain('.ruleprobe/semantic-log');
    expect(existsSync(logPath)).toBe(true);
  });
});

describe('formatAuditLog', () => {
  it('formats a performed analysis log', () => {
    const text = formatAuditLog(makePipelineResult());
    expect(text).toContain('Performed: true');
    expect(text).toContain('Files scanned: 1');
    expect(text).toContain('Rules sent: 1');
    expect(text).toContain('Verdicts received: 1');
    expect(text).toContain('Fast-path resolutions: 1');
  });

  it('formats a skipped analysis log', () => {
    const result = makePipelineResult({
      performed: false,
      skipReason: 'API unreachable',
      verdicts: [],
    });
    const text = formatAuditLog(result);
    expect(text).toContain('Performed: false');
    expect(text).toContain('Skip reason: API unreachable');
  });

  it('includes audit log markers', () => {
    const text = formatAuditLog(makePipelineResult());
    expect(text).toContain('--- Semantic Analysis Audit Log ---');
    expect(text).toContain('--- End Audit Log ---');
  });
});
