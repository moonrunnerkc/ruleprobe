import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cacheKey, readCache, writeCache } from '../../src/dataset/cache.js';
import {
  parseFileContent,
  computeMedian,
  computePercentile,
  buildHistogram,
  clusterUnparseable,
  generateSummary,
  type PerFileResult,
} from '../../src/dataset/summary.js';

const FIXTURE_DIR = join(__dirname, '__cache_fixtures__');

describe('collect.ts', () => {
  beforeEach(() => {
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  describe('cacheKey', () => {
    it('produces a safe filesystem path from a prefix and identifier', () => {
      const key = cacheKey('repo', 'moonrunnerkc-ruleprobe');
      expect(key).toContain('repo-moonrunnerkc-ruleprobe.json');
    });

    it('replaces slashes in identifier with underscores', () => {
      const key = cacheKey('search', 'path/to/something');
      expect(key).toContain('search-path_to_something.json');
    });
  });

  describe('readCache / writeCache', () => {
    it('round-trips data through the cache', () => {
      const key = join(FIXTURE_DIR, 'test-entry.json');
      const data = { stars: 42, name: 'ruleprobe' };

      writeCache(key, data);
      const result = readCache<typeof data>(key, 60_000);

      expect(result).toEqual(data);
    });

    it('returns null when the cache key does not exist', () => {
      const key = join(FIXTURE_DIR, 'nonexistent.json');
      expect(readCache(key, 60_000)).toBeNull();
    });

    it('returns null when the cache entry has expired', () => {
      const key = join(FIXTURE_DIR, 'expired-entry.json');
      writeFileSync(key, JSON.stringify({ timestamp: Date.now() - 100_000, data: { old: true } }));

      const result = readCache(key, 1);
      expect(result).toBeNull();
    });

    it('returns null for malformed cache entries', () => {
      const key = join(FIXTURE_DIR, 'bad-entry.json');
      writeFileSync(key, 'not json at all');

      const result = readCache(key, 60_000);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  describe('computeMedian', () => {
    it('returns 0 for an empty array', () => {
      expect(computeMedian([])).toBe(0);
    });

    it('computes median for odd-length arrays', () => {
      expect(computeMedian([3, 1, 2])).toBe(2);
    });

    it('computes median for even-length arrays', () => {
      expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
    });

    it('handles single-element arrays', () => {
      expect(computeMedian([7])).toBe(7);
    });
  });

  describe('computePercentile', () => {
    it('returns 0 for an empty array', () => {
      expect(computePercentile([], 75)).toBe(0);
    });

    it('computes the 75th percentile', () => {
      // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const values = Array.from({ length: 10 }, (_, i) => i + 1);
      const p75 = computePercentile(values, 75);
      expect(p75).toBe(8);
    });

    it('computes the 90th percentile', () => {
      const values = Array.from({ length: 10 }, (_, i) => i + 1);
      const p90 = computePercentile(values, 90);
      expect(p90).toBe(9);
    });
  });

  // ---------------------------------------------------------------------------
  // Histogram
  // ---------------------------------------------------------------------------

  describe('buildHistogram', () => {
    it('returns "No data" for empty input', () => {
      expect(buildHistogram([])).toBe('No data');
    });

    it('groups values into correct buckets', () => {
      const values = [0, 0, 3, 7, 12, 25, 60];
      const histogram = buildHistogram(values);
      expect(histogram).toContain('0 |');
      expect(histogram).toContain('1-4 |');
      expect(histogram).toContain('5-9 |');
      expect(histogram).toContain('10-19 |');
      expect(histogram).toContain('20-49 |');
      expect(histogram).toContain('50+ |');
    });

    it('draws bars proportional to counts', () => {
      const values = [5, 5, 5, 5, 5];
      const histogram = buildHistogram(values);
      const line5_9 = histogram.split('\n').find((l) => l.includes('5-9'));
      expect(line5_9).toBeTruthy();
      expect(line5_9!.includes('#####')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unparseable clustering
  // ---------------------------------------------------------------------------

  describe('clusterUnparseable', () => {
    it('groups similar lines by normalized form', () => {
      const lines = [
        'Use conventional commits',
        'use conventional commits',
        '  Use conventional commits  ',
        'Always write tests',
      ];

      const clusters = clusterUnparseable(lines);
      expect(clusters.length).toBe(2);

      const commitsCluster = clusters.find((c) => c.pattern.includes('conventional'));
      expect(commitsCluster).toBeTruthy();
      expect(commitsCluster!.count).toBe(3);
    });

    it('sorts by count descending', () => {
      const lines = [
        'rare pattern',
        'common pattern',
        'common pattern',
        'common pattern',
      ];

      const clusters = clusterUnparseable(lines);
      expect(clusters[0].pattern).toContain('common');
      expect(clusters[0].count).toBe(3);
    });

    it('skips lines shorter than 3 characters', () => {
      const lines = ['a', 'ab', 'abc', 'valid line here'];
      const clusters = clusterUnparseable(lines);
      expect(clusters.every((c) => c.pattern.length >= 3)).toBe(true);
    });

    it('strips leading markdown characters', () => {
      const lines = ['- Always use strict mode'];
      const clusters = clusterUnparseable(lines);
      expect(clusters[0].pattern.startsWith('-')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // parseFileContent
  // ---------------------------------------------------------------------------

  describe('parseFileContent', () => {
    it('parses a CLAUDE.md file and extracts rules', () => {
      const content = [
        '# CLAUDE.md',
        '',
        '## Code Style',
        '',
        '- Always use TypeScript strict mode.',
        '- Never use `any`. Use `unknown` and narrow.',
        '- Use camelCase for variables and functions.',
        '',
        '## Testing',
        '',
        '- Every new function requires at least one test.',
        '- Test names describe behavior, not implementation.',
      ].join('\n');

      const result = parseFileContent(content, 'CLAUDE.md');
      expect(result.sourceType).toBe('claude.md');
      expect(result.parseableRuleCount).toBeGreaterThan(0);
      expect(result.parseError).toBeNull();
    });

    it('handles empty content gracefully', () => {
      const result = parseFileContent('', 'CLAUDE.md');
      expect(result.parseableRuleCount).toBe(0);
      expect(result.unparseableLines).toEqual([]);
    });

    it('populates categoryBreakdown from parsed rules', () => {
      const content = [
        '# Test',
        '',
        '- Always use TypeScript strict mode.',
        '- Never use `any`.',
        '- Every function requires a test.',
      ].join('\n');

      const result = parseFileContent(content, 'CLAUDE.md');
      const totalFromBreakdown = Object.values(result.categoryBreakdown).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(totalFromBreakdown).toBe(result.parseableRuleCount);
    });
  });

  // ---------------------------------------------------------------------------
  // generateSummary
  // ---------------------------------------------------------------------------

  describe('generateSummary', () => {
    function makeResult(overrides: Partial<PerFileResult> = {}): PerFileResult {
      return {
        repoUrl: 'https://github.com/test/repo',
        repoStars: 100,
        filePath: 'CLAUDE.md',
        sourceType: 'claude.md',
        parseableRuleCount: 0,
        categoryBreakdown: {},
        unparseableLines: [],
        parseError: null,
        ...overrides,
      };
    }

    it('renders a GO verdict when median >= 5 and P75 >= 10', () => {
      const results: PerFileResult[] = [
        makeResult({ parseableRuleCount: 12, categoryBreakdown: { naming: 5, 'code-style': 7 } }),
        makeResult({ parseableRuleCount: 15, categoryBreakdown: { naming: 8, structure: 7 } }),
        makeResult({ parseableRuleCount: 8, categoryBreakdown: { naming: 8 } }),
        makeResult({ parseableRuleCount: 20, categoryBreakdown: { naming: 10, 'code-style': 10 } }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('GO');
      expect(summary).toContain('Median');
      expect(summary).toContain('75th percentile');
    });

    it('renders a NO-GO verdict when median < 5', () => {
      const results: PerFileResult[] = [
        makeResult({ parseableRuleCount: 2 }),
        makeResult({ parseableRuleCount: 3 }),
        makeResult({ parseableRuleCount: 1 }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('NO-GO');
    });

    it('renders a NO-GO verdict when P75 < 10', () => {
      const results: PerFileResult[] = [
        makeResult({ parseableRuleCount: 7 }),
        makeResult({ parseableRuleCount: 6 }),
        makeResult({ parseableRuleCount: 5 }),
        makeResult({ parseableRuleCount: 5 }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('NO-GO');
    });

    it('includes top rule categories', () => {
      const results: PerFileResult[] = [
        makeResult({
          parseableRuleCount: 10,
          categoryBreakdown: { naming: 5, 'code-style': 3, testing: 2 },
        }),
        makeResult({
          parseableRuleCount: 5,
          categoryBreakdown: { naming: 3, testing: 2 },
        }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('naming');
      expect(summary).toContain('8');
    });

    it('includes unparseable patterns', () => {
      const results: PerFileResult[] = [
        makeResult({
          parseableRuleCount: 5,
          unparseableLines: ['Use conventional commits', 'Use conventional commits', 'Be nice to people'],
        }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('conventional');
    });

    it('renders histogram for rule count distribution', () => {
      const results: PerFileResult[] = [
        makeResult({ parseableRuleCount: 0 }),
        makeResult({ parseableRuleCount: 3 }),
        makeResult({ parseableRuleCount: 7 }),
        makeResult({ parseableRuleCount: 15 }),
      ];

      const summary = generateSummary(results);
      expect(summary).toContain('1-4');
      expect(summary).toContain('5-9');
    });

    it('handles zero results gracefully', () => {
      const summary = generateSummary([]);
      expect(summary).toContain('NO-GO');
      expect(summary).toContain('No data');
    });
  });
});