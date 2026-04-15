/**
 * Content-hash profile cache for fingerprint reuse.
 *
 * Caches StructuralProfile on disk and in memory keyed by
 * extractionHash. On cache hit, the entire profiling step
 * is skipped. No git, no mtime: content hash only.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { StructuralProfile, PatternTopic, FeatureVector, CrossFileGraph } from '../../types.js';

/** Default server-side cache directory. */
const CACHE_DIR = '.ruleprobe-semantic/profiles';

/**
 * Maximum in-memory cache entries.
 * Prevents unbounded memory growth on long-running servers.
 */
const MAX_MEMORY_ENTRIES = 50;

/** Serializable form of StructuralProfile for JSON persistence. */
interface SerializedProfile {
  profileId: string;
  generatedAt: string;
  featureVectors: Record<string, FeatureVector>;
  crossFileGraph: { edges: Record<string, Record<string, string[]>> };
  sampleSize: number;
}

/**
 * Cache for StructuralProfile instances, keyed by content hash.
 *
 * Uses in-memory LRU eviction and disk persistence.
 */
export class FingerprintCache {
  private readonly memoryCache = new Map<string, StructuralProfile>();
  private readonly cacheDir: string;

  /**
   * Create a fingerprint cache.
   *
   * @param baseDir - Base directory for disk cache (the cache dir is created under this)
   */
  constructor(baseDir: string) {
    this.cacheDir = join(baseDir, CACHE_DIR);
  }

  /**
   * Look up a cached profile by extraction hash.
   *
   * Checks memory first, then disk. Returns undefined on miss.
   *
   * @param extractionHash - Content hash of the extraction
   * @returns Cached profile, or undefined
   */
  get(extractionHash: string): StructuralProfile | undefined {
    const memHit = this.memoryCache.get(extractionHash);
    if (memHit) {
      return memHit;
    }

    const diskHit = this.readFromDisk(extractionHash);
    if (diskHit) {
      this.setMemory(extractionHash, diskHit);
      return diskHit;
    }

    return undefined;
  }

  /**
   * Store a profile in cache (memory + disk).
   *
   * @param extractionHash - Content hash of the extraction
   * @param profile - The profile to cache
   */
  set(extractionHash: string, profile: StructuralProfile): void {
    this.setMemory(extractionHash, profile);
    this.writeToDisk(extractionHash, profile);
  }

  /**
   * Check whether a profile exists in cache without loading it.
   *
   * @param extractionHash - Content hash to check
   * @returns True if cached
   */
  has(extractionHash: string): boolean {
    if (this.memoryCache.has(extractionHash)) {
      return true;
    }
    const filePath = this.diskPath(extractionHash);
    return existsSync(filePath);
  }

  /**
   * Clear all cached profiles (memory + disk not cleared).
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }

  /**
   * Get the number of in-memory cache entries.
   *
   * @returns Entry count
   */
  memorySize(): number {
    return this.memoryCache.size;
  }

  private setMemory(key: string, profile: StructuralProfile): void {
    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(key, profile);
  }

  private diskPath(hash: string): string {
    return join(this.cacheDir, `${hash}.json`);
  }

  private readFromDisk(hash: string): StructuralProfile | undefined {
    const filePath = this.diskPath(hash);
    if (!existsSync(filePath)) {
      return undefined;
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed: SerializedProfile = JSON.parse(raw);
      return deserializeProfile(parsed);
    } catch {
      return undefined;
    }
  }

  private writeToDisk(hash: string, profile: StructuralProfile): void {
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      const serialized = serializeProfile(profile);
      writeFileSync(this.diskPath(hash), JSON.stringify(serialized, null, 2), 'utf-8');
    } catch {
      // Disk write failure is non-fatal; cache remains in memory
    }
  }
}

/**
 * Serialize a StructuralProfile to a JSON-compatible form.
 *
 * Converts Map instances to plain objects for JSON.stringify.
 *
 * @param profile - The profile to serialize
 * @returns JSON-compatible representation
 */
export function serializeProfile(
  profile: StructuralProfile,
): SerializedProfile {
  const featureVectors: Record<string, FeatureVector> = {};
  for (const [key, value] of profile.featureVectors) {
    featureVectors[key] = value;
  }

  const edges: Record<string, Record<string, string[]>> = {};
  for (const [fileId, sigMap] of profile.crossFileGraph.edges) {
    const sigs: Record<string, string[]> = {};
    for (const [sig, peers] of sigMap) {
      sigs[sig] = peers;
    }
    edges[fileId] = sigs;
  }

  return {
    profileId: profile.profileId,
    generatedAt: profile.generatedAt,
    featureVectors,
    crossFileGraph: { edges },
    sampleSize: profile.sampleSize,
  };
}

/**
 * Deserialize a JSON-parsed profile back to StructuralProfile.
 *
 * Converts plain objects back to Map instances.
 *
 * @param data - Parsed JSON data
 * @returns Reconstituted StructuralProfile
 */
export function deserializeProfile(
  data: SerializedProfile,
): StructuralProfile {
  const featureVectors = new Map<PatternTopic, FeatureVector>();
  for (const [key, value] of Object.entries(data.featureVectors)) {
    featureVectors.set(key, value);
  }

  const edges = new Map<string, Map<string, string[]>>();
  for (const [fileId, sigMap] of Object.entries(data.crossFileGraph.edges)) {
    const inner = new Map<string, string[]>();
    for (const [sig, peers] of Object.entries(sigMap)) {
      inner.set(sig, peers);
    }
    edges.set(fileId, inner);
  }

  return {
    profileId: data.profileId,
    generatedAt: data.generatedAt,
    featureVectors,
    crossFileGraph: { edges },
    sampleSize: data.sampleSize,
  };
}
