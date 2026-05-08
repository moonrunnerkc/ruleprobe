/**
 * GitHub API client with exponential backoff and caching.
 *
 * Handles code search, repo metadata, and file content retrieval
 * for the Phase 0 data collection pipeline.
 */

import { cacheKey, readCache, writeCache } from './cache.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;
const SEARCH_PAGE_DELAY_MS = 2500;
const REPO_FETCH_DELAY_MS = 200;
const FILE_FETCH_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResultItem {
  owner: string;
  repo: string;
  fullName: string;
  path: string;
  filename: string;
}

export interface RepoMetadata {
  stars: number;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  archived: boolean;
}

export interface QualifiedRepo {
  fullName: string;
  owner: string;
  repo: string;
  stars: number;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  files: SearchResultItem[];
}

// ---------------------------------------------------------------------------
// HTTP with exponential backoff
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] ?? '';

const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ruleprobe-collect',
};
if (GITHUB_TOKEN) {
  headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL from the GitHub API with exponential backoff on 403/429.
 *
 * Retries up to MAX_RETRIES times with doubling delay. If a rate limit
 * is hit (x-ratelimit-remaining: 0), waits until the reset time instead.
 */
export async function githubFetch(url: string, retries = MAX_RETRIES): Promise<unknown | null> {
  let delay = BASE_DELAY_MS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers });

    if (response.ok) {
      return response.json();
    }

    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetTime = response.headers.get('x-ratelimit-reset');

    if ((response.status === 403 || response.status === 429) && attempt < retries) {
      if (remaining === '0' && resetTime) {
        const resetDate = new Date(parseInt(resetTime, 10) * 1000);
        const waitMs = Math.max(resetDate.getTime() - Date.now() + 1000, delay);
        console.log(`  Rate limited (remaining=0). Waiting ${Math.ceil(waitMs / 1000)}s until ${resetDate.toISOString()}`);
        await sleep(waitMs);
        continue;
      }

      console.log(`  ${response.status} on attempt ${attempt + 1}. Retrying in ${delay}ms...`);
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
      continue;
    }

    if (response.status === 422) {
      console.log(`  422 for ${url}, skipping`);
      return null;
    }

    if (response.status === 404) {
      return null;
    }

    console.error(`  HTTP ${response.status} for ${url}`);
    const body = await response.text();
    console.error(`  ${body.slice(0, 200)}`);
    return null;
  }

  console.error(`  Max retries exceeded for ${url}`);
  return null;
}

// ---------------------------------------------------------------------------
// GitHub search + fetch
// ---------------------------------------------------------------------------

/** Search GitHub code for a specific filename at repo root. */
export async function searchForFile(filename: string): Promise<SearchResultItem[]> {
  const query = encodeURIComponent(`filename:${filename} path:/`);
  const results: SearchResultItem[] = [];

  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/search/code?q=${query}&per_page=100&page=${page}`;
    console.log(`  Searching page ${page} for ${filename}...`);

    const data = await githubFetch(url) as { items?: Array<{
      repository: { owner: { login: string }; name: string; full_name: string };
      path: string;
    }> } | null;

    if (!data?.items?.length) break;

    for (const item of data.items) {
      const itemPath = item.path;
      const isRoot = !itemPath.includes('/');
      const isGithubDir = itemPath.startsWith('.github/');
      if (isRoot || isGithubDir) {
        results.push({
          owner: item.repository.owner.login,
          repo: item.repository.name,
          fullName: item.repository.full_name,
          path: itemPath,
          filename,
        });
      }
    }

    console.log(`    Found ${data.items.length} results (${results.length} at root so far)`);
    if (data.items.length < 100) break;
    await sleep(SEARCH_PAGE_DELAY_MS);
  }

  return results;
}

/** Fetch repo metadata (stars, language, etc.) with caching. */
export async function getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata | null> {
  const key = cacheKey('repo', `${owner}-${repo}`);
  const cached = readCache<RepoMetadata>(key, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const data = await githubFetch(url) as {
    stargazers_count: number;
    description: string | null;
    language: string | null;
    default_branch: string;
    archived: boolean;
  } | null;

  if (!data) return null;

  const metadata: RepoMetadata = {
    stars: data.stargazers_count,
    description: data.description,
    language: data.language,
    defaultBranch: data.default_branch,
    archived: data.archived,
  };

  writeCache(key, metadata);
  return metadata;
}

/** Download raw file content from GitHub with caching. */
export async function downloadFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | null> {
  const key = cacheKey('file', `${owner}-${repo}-${path.replace(/\//g, '_')}`);
  const cached = readCache<string>(key, 7 * 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'ruleprobe-collect' } });

  if (!response.ok) {
    console.log(`    Failed to download ${owner}/${repo}/${path}: HTTP ${response.status}`);
    return null;
  }

  const content = await response.text();
  writeCache(key, content);
  return content;
}

/** Sleep between API calls to avoid rate limiting. */
export function apiDelay(type: 'search' | 'repo' | 'file'): Promise<void> {
  const ms = type === 'search' ? SEARCH_PAGE_DELAY_MS
    : type === 'repo' ? REPO_FETCH_DELAY_MS
    : FILE_FETCH_DELAY_MS;
  return sleep(ms);
}