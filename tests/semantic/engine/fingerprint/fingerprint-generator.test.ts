/**
 * Tests for fingerprint generator.
 */

import { describe, it, expect } from 'vitest';
import type { RawExtractionPayload, RawFileVector, ExtractedRulePayload } from '../../../../src/semantic/types.js';
import {
  generateFingerprint,
  resolveRelevantTopics,
  buildFeatureVector,
  buildCrossFileGraph,
} from '../../../../src/semantic/engine/fingerprint/fingerprint-generator.js';
import { TopicRegistry, BASE_TOPICS } from '../../../../src/semantic/engine/fingerprint/topic-registry.js';

function makeVector(overrides?: Partial<RawFileVector>): RawFileVector {
  return {
    nodeTypeCounts: {},
    nestingDepths: {},
    subTreeHashes: [],
    ...overrides,
  };
}

function makeRule(overrides?: Partial<ExtractedRulePayload>): ExtractedRulePayload {
  return {
    ruleId: 'r1',
    ruleText: 'Use try/catch for error handling',
    qualifier: 'always',
    confidence: 0.9,
    ...overrides,
  };
}

function makePayload(
  fileCount: number,
  rules: ExtractedRulePayload[],
  vectorFn?: (i: number) => Partial<RawFileVector>,
): RawExtractionPayload {
  const fileVectors: Record<string, RawFileVector> = {};
  for (let i = 0; i < fileCount; i++) {
    const overrides = vectorFn ? vectorFn(i) : { nodeTypeCounts: { try_statement: 2 + i, catch_clause: 2 + i } };
    fileVectors[String(i)] = makeVector(overrides);
  }
  return {
    fileVectors,
    rules,
    extractionHash: 'test-hash-123',
  };
}

describe('resolveRelevantTopics', () => {
  it('matches rules to topics by keyword', () => {
    const registry = new TopicRegistry();
    const rules = [makeRule({ ruleText: 'Use try/catch for error handling' })];
    const topics = resolveRelevantTopics(registry, rules);
    const ids = topics.map((t) => t.topic);
    expect(ids).toContain('error-handling');
  });

  it('deduplicates when multiple rules match same topic', () => {
    const registry = new TopicRegistry();
    const rules = [
      makeRule({ ruleId: 'r1', ruleText: 'Use error handling' }),
      makeRule({ ruleId: 'r2', ruleText: 'Wrap exceptions properly' }),
    ];
    const topics = resolveRelevantTopics(registry, rules);
    const errorTopics = topics.filter((t) => t.topic === 'error-handling');
    expect(errorTopics.length).toBe(1);
  });

  it('returns empty when no rules match', () => {
    const registry = new TopicRegistry();
    const rules = [makeRule({ ruleText: 'Use a database migration tool' })];
    const topics = resolveRelevantTopics(registry, rules);
    expect(topics.length).toBe(0);
  });
});

describe('generateFingerprint', () => {
  it('produces a StructuralProfile with correct profileId', () => {
    const payload = makePayload(5, [makeRule()]);
    const profile = generateFingerprint(payload);
    expect(profile.profileId).toBe('test-hash-123');
  });

  it('profile sampleSize matches file count', () => {
    const payload = makePayload(10, [makeRule()]);
    const profile = generateFingerprint(payload);
    expect(profile.sampleSize).toBe(10);
  });

  it('generates featureVectors for matched topics', () => {
    const payload = makePayload(5, [makeRule()]);
    const profile = generateFingerprint(payload);
    expect(profile.featureVectors.size).toBeGreaterThan(0);
  });

  it('skips topics with fewer than 3 example files', () => {
    const payload = makePayload(2, [makeRule()]);
    const profile = generateFingerprint(payload);
    // With only 2 files, the minimum sample requirement is not met
    expect(profile.featureVectors.size).toBe(0);
  });

  it('featureVector prevalence is between 0 and 1', () => {
    const payload = makePayload(10, [makeRule()]);
    const profile = generateFingerprint(payload);
    for (const [, vector] of profile.featureVectors) {
      expect(vector.prevalence).toBeGreaterThanOrEqual(0);
      expect(vector.prevalence).toBeLessThanOrEqual(1);
    }
  });

  it('produces a generatedAt timestamp', () => {
    const payload = makePayload(5, [makeRule()]);
    const profile = generateFingerprint(payload);
    expect(profile.generatedAt).toBeTruthy();
    expect(new Date(profile.generatedAt).toString()).not.toBe('Invalid Date');
  });
});

describe('buildFeatureVector', () => {
  it('normalizes counts per file', () => {
    const errorTopic = BASE_TOPICS.find((t) => t.topic === 'error-handling');
    expect(errorTopic).toBeDefined();

    const examples = [
      { fileId: '0', vector: makeVector({ nodeTypeCounts: { try_statement: 4 } }), relevanceScore: 1 },
      { fileId: '1', vector: makeVector({ nodeTypeCounts: { try_statement: 6 } }), relevanceScore: 1 },
    ];

    const fv = buildFeatureVector(errorTopic!, examples, 10);
    expect(fv.nodeTypeCounts['try_statement']).toBe(5); // (4+6)/2
  });

  it('computes prevalence from example count vs total', () => {
    const errorTopic = BASE_TOPICS.find((t) => t.topic === 'error-handling');
    const examples = [
      { fileId: '0', vector: makeVector({ nodeTypeCounts: { try_statement: 1 } }), relevanceScore: 1 },
      { fileId: '1', vector: makeVector({ nodeTypeCounts: { try_statement: 1 } }), relevanceScore: 1 },
      { fileId: '2', vector: makeVector({ nodeTypeCounts: { try_statement: 1 } }), relevanceScore: 1 },
    ];

    const fv = buildFeatureVector(errorTopic!, examples, 10);
    expect(fv.prevalence).toBeCloseTo(0.3, 5);
  });
});

describe('buildCrossFileGraph', () => {
  it('groups files with identical node type distributions', () => {
    const errorTopic = BASE_TOPICS.find((t) => t.topic === 'error-handling')!;
    const fileVectors: Record<string, RawFileVector> = {
      '0': makeVector({ nodeTypeCounts: { try_statement: 3, catch_clause: 3 } }),
      '1': makeVector({ nodeTypeCounts: { try_statement: 3, catch_clause: 3 } }),
      '2': makeVector({ nodeTypeCounts: { try_statement: 3, catch_clause: 3 } }),
    };

    const graph = buildCrossFileGraph([errorTopic], fileVectors);
    // All three files should be peers of each other
    expect(graph.edges.size).toBeGreaterThan(0);
  });

  it('returns empty edges when no files share patterns', () => {
    const errorTopic = BASE_TOPICS.find((t) => t.topic === 'error-handling')!;
    const fileVectors: Record<string, RawFileVector> = {
      '0': makeVector({ nodeTypeCounts: { import_statement: 1 } }),
      '1': makeVector({ nodeTypeCounts: { import_statement: 2 } }),
    };

    const graph = buildCrossFileGraph([errorTopic], fileVectors);
    // No files have error-handling node types, so no edges
    expect(graph.edges.size).toBe(0);
  });

  it('returns a CrossFileGraph with edges as a Map', () => {
    const errorTopic = BASE_TOPICS.find((t) => t.topic === 'error-handling')!;
    const fileVectors: Record<string, RawFileVector> = {
      '0': makeVector({ nodeTypeCounts: { try_statement: 1 } }),
    };

    const graph = buildCrossFileGraph([errorTopic], fileVectors);
    expect(graph.edges).toBeInstanceOf(Map);
  });
});
