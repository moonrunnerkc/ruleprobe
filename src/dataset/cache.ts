/**
 * File-based cache for GitHub API responses.
 *
 * Stores timestamped JSON entries so the Phase 0 collection script can
 * skip redundant network calls on re-runs.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.cache');

/**
 * Build a cache key from a prefix and identifier.
 *
 * @param prefix - Cache category (e.g. "repo", "file", "search")
 * @param identifier - Unique identifier within that category
 * @param cacheDir - Override cache directory (for testing)
 */
export function cacheKey(prefix: string, identifier: string, cacheDir = CACHE_DIR): string {
  const safe = identifier.replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(cacheDir, `${prefix}-${safe}.json`);
}

/**
 * Read a cached entry if it exists and hasn't expired.
 *
 * @param key - File path returned by cacheKey()
 * @param maxAgeMs - Maximum age in milliseconds before the entry is stale
 * @returns The cached data, or null if missing/expired/malformed
 */
export function readCache<T>(key: string, maxAgeMs: number): T | null {
  if (!existsSync(key)) return null;
  try {
    const raw = readFileSync(key, 'utf-8');
    const entry: { timestamp: number; data: T } = JSON.parse(raw);
    if (Date.now() - entry.timestamp > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Write an entry to the cache.
 *
 * @param key - File path returned by cacheKey()
 * @param data - Data to cache
 */
export function writeCache<T>(key: string, data: T): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const entry = { timestamp: Date.now(), data };
  writeFileSync(key, JSON.stringify(entry));
}