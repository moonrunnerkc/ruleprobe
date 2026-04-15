/**
 * Path-based exclusion counter for prefer-pairs that depend
 * on file location (e.g., Next.js page routes, Storybook stories).
 *
 * These exclusions cannot be detected from AST alone; they require
 * checking the file path against framework-specific patterns.
 * Framework presence is verified via package.json dependencies.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Result of path-based exclusion counting.
 */
export interface PathExclusionResult {
  excluded: number;
  breakdown: Array<{ label: string; count: number; reason: string }>;
}

/**
 * Next.js page/route path patterns (relative to project root).
 * These files REQUIRE default exports per the Next.js framework.
 */
const NEXTJS_PAGE_PATTERNS = [
  /^pages\/.*\.(tsx|jsx|ts|js)$/,
  /^src\/pages\/.*\.(tsx|jsx|ts|js)$/,
  /^app\/.*\/page\.(tsx|jsx|ts|js)$/,
  /^src\/app\/.*\/page\.(tsx|jsx|ts|js)$/,
];

/** Next.js layout/loading/error patterns. */
const NEXTJS_LAYOUT_PATTERNS = [
  /^app\/.*\/layout\.(tsx|jsx|ts|js)$/,
  /^src\/app\/.*\/layout\.(tsx|jsx|ts|js)$/,
  /^app\/.*\/loading\.(tsx|jsx|ts|js)$/,
  /^src\/app\/.*\/loading\.(tsx|jsx|ts|js)$/,
  /^app\/.*\/error\.(tsx|jsx|ts|js)$/,
  /^src\/app\/.*\/error\.(tsx|jsx|ts|js)$/,
  /^app\/.*\/not-found\.(tsx|jsx|ts|js)$/,
  /^src\/app\/.*\/not-found\.(tsx|jsx|ts|js)$/,
];

/** Remix route patterns. */
const REMIX_ROUTE_PATTERNS = [
  /^app\/routes\/.*\.(tsx|jsx|ts|js)$/,
];

/** Storybook story patterns. */
const STORYBOOK_PATTERNS = [
  /\.stories\.(tsx|ts|jsx|js)$/,
];

/**
 * Check if a dependency exists in package.json.
 *
 * @param projectDir - Project root directory
 * @param depName - Dependency name to search for
 * @returns True if dependency found in dependencies or devDependencies
 */
function hasDependency(projectDir: string, depName: string): boolean {
  const pkgPath = join(projectDir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
    const deps = (pkg['dependencies'] ?? {}) as Record<string, unknown>;
    const devDeps = (pkg['devDependencies'] ?? {}) as Record<string, unknown>;
    return depName in deps || depName in devDeps;
  } catch {
    return false;
  }
}

/**
 * Count path-based exclusions for named-vs-default-exports.
 *
 * Only applies framework-specific exclusions if the framework
 * is detected in package.json dependencies.
 *
 * @param filePaths - All file paths being analyzed
 * @param projectDir - Project root directory for package.json lookup
 * @returns Path exclusion result with breakdown
 */
export function countPathExclusions(
  filePaths: string[],
  projectDir: string,
): PathExclusionResult {
  const hasNext = hasDependency(projectDir, 'next');
  const hasRemix = hasDependency(projectDir, '@remix-run/react');
  const hasStorybook = hasDependency(projectDir, 'storybook') ||
    hasDependency(projectDir, '@storybook/react');

  let nextPages = 0;
  let nextLayouts = 0;
  let remixRoutes = 0;
  let storybook = 0;

  for (const fp of filePaths) {
    const rel = relative(projectDir, fp).replace(/\\/g, '/');

    if (hasNext) {
      if (NEXTJS_PAGE_PATTERNS.some((p) => p.test(rel))) {
        nextPages += 1;
        continue;
      }
      if (NEXTJS_LAYOUT_PATTERNS.some((p) => p.test(rel))) {
        nextLayouts += 1;
        continue;
      }
    }

    if (hasRemix && REMIX_ROUTE_PATTERNS.some((p) => p.test(rel))) {
      remixRoutes += 1;
      continue;
    }

    if (hasStorybook && STORYBOOK_PATTERNS.some((p) => p.test(rel))) {
      storybook += 1;
      continue;
    }
  }

  const breakdown: PathExclusionResult['breakdown'] = [];
  if (nextPages > 0) {
    breakdown.push({ label: 'Next.js pages', count: nextPages, reason: 'Next.js pages require default exports' });
  }
  if (nextLayouts > 0) {
    breakdown.push({ label: 'Next.js layouts', count: nextLayouts, reason: 'Next.js layouts/error/loading require default exports' });
  }
  if (remixRoutes > 0) {
    breakdown.push({ label: 'Remix routes', count: remixRoutes, reason: 'Remix routes require default exports' });
  }
  if (storybook > 0) {
    breakdown.push({ label: 'Storybook', count: storybook, reason: 'Storybook story files use default exports' });
  }

  const excluded = nextPages + nextLayouts + remixRoutes + storybook;
  return { excluded, breakdown };
}
