/**
 * Tests for fingerprint cache: memory, disk, serialization.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StructuralProfile } from '../../../../src/semantic/types.js';
import {
  FingerprintCache,
  serializeProfile,
  deserializeProfile,
} from '../../../../src/semantic/engine/fingerprint/fingerprint-cache.js';

function makeProfile(id: string): StructuralProfile {
  const featureVectors = new Map();
  featureVectors.set('error-handling', {
    nodeTypeCounts: { try_statement: 5.0 },
    nestingDepths: { try_statement: 1.5 },
    patternSignatures: ['sig1', 'sig2'],
    prevalence: 0.3,
  });

  const edges = new Map();
  const inner = new Map();
  inner.set('sig1', ['1', '2']);
  edges.set('0', inner);

  return {
    profileId: id,
    generatedAt: '2026-01-01T00:00:00Z',
    featureVectors,
    crossFileGraph: { edges },
    sampleSize: 10,
  };
}

describe('FingerprintCache memory operations', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns undefined on cache miss', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache = new FingerprintCache(tempDir);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a profile', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache = new FingerprintCache(tempDir);
    const profile = makeProfile('hash1');
    cache.set('hash1', profile);
    const retrieved = cache.get('hash1');
    expect(retrieved?.profileId).toBe('hash1');
  });

  it('has() returns true for cached items', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache = new FingerprintCache(tempDir);
    cache.set('hash1', makeProfile('hash1'));
    expect(cache.has('hash1')).toBe(true);
    expect(cache.has('hash2')).toBe(false);
  });

  it('clearMemory removes memory entries', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache = new FingerprintCache(tempDir);
    cache.set('hash1', makeProfile('hash1'));
    expect(cache.memorySize()).toBe(1);
    cache.clearMemory();
    expect(cache.memorySize()).toBe(0);
  });
});

describe('FingerprintCache disk operations', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('persists to disk and reads back', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache1 = new FingerprintCache(tempDir);
    cache1.set('hash1', makeProfile('hash1'));

    // New cache instance (no memory)
    const cache2 = new FingerprintCache(tempDir);
    const retrieved = cache2.get('hash1');
    expect(retrieved?.profileId).toBe('hash1');
    expect(retrieved?.sampleSize).toBe(10);
  });

  it('creates cache directory automatically', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache = new FingerprintCache(tempDir);
    cache.set('hash1', makeProfile('hash1'));
    expect(existsSync(join(tempDir, '.ruleprobe-semantic/profiles'))).toBe(true);
  });

  it('has() detects disk entries', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fp-cache-'));
    const cache1 = new FingerprintCache(tempDir);
    cache1.set('hash1', makeProfile('hash1'));

    const cache2 = new FingerprintCache(tempDir);
    expect(cache2.has('hash1')).toBe(true);
  });
});

describe('serialization round-trip', () => {
  it('preserves featureVectors through serialize/deserialize', () => {
    const profile = makeProfile('rt-test');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);

    expect(restored.featureVectors.size).toBe(1);
    const fv = restored.featureVectors.get('error-handling');
    expect(fv?.nodeTypeCounts['try_statement']).toBe(5.0);
    expect(fv?.prevalence).toBe(0.3);
  });

  it('preserves crossFileGraph through serialize/deserialize', () => {
    const profile = makeProfile('rt-test');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);

    expect(restored.crossFileGraph.edges.size).toBe(1);
    const inner = restored.crossFileGraph.edges.get('0');
    expect(inner?.get('sig1')).toEqual(['1', '2']);
  });

  it('preserves scalar fields', () => {
    const profile = makeProfile('rt-test');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);

    expect(restored.profileId).toBe('rt-test');
    expect(restored.generatedAt).toBe('2026-01-01T00:00:00Z');
    expect(restored.sampleSize).toBe(10);
  });
});
