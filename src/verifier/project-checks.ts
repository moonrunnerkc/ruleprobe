/**
 * Project-level filesystem checks: tsconfig strict mode,
 * file existence, formatter config detection, and dependency
 * version pinning.
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, relative, resolve, dirname, join } from 'node:path';
import type { Evidence } from '../types.js';

/**
 * Find tsconfig.json by walking up from outputDir through ancestor
 * directories (up to 5 levels or filesystem root).
 */
function findTsconfig(outputDir: string): { path: string; searched: string[] } | { path: null; searched: string[] } {
  const searched: string[] = [];
  let current = resolve(outputDir);
  const maxLevels = 5;

  for (let i = 0; i <= maxLevels; i++) {
    const candidate = join(current, 'tsconfig.json');
    searched.push(current);
    if (existsSync(candidate)) {
      return { path: candidate, searched };
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return { path: null, searched };
}

/**
 * Check for the existence of a tsconfig.json with strict mode enabled.
 *
 * Walks up from outputDir to find tsconfig.json in ancestor directories.
 */
export function checkStrictMode(outputDir: string): Evidence[] {
  const result = findTsconfig(outputDir);

  if (result.path === null) {
    return [{
      file: 'tsconfig.json',
      line: null,
      found: `tsconfig.json not found (searched: ${result.searched.join(', ')})`,
      expected: 'tsconfig.json with strict: true',
      context: '',
    }];
  }

  try {
    const content = readFileSync(result.path, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'compilerOptions' in parsed
    ) {
      const opts = (parsed as Record<string, unknown>)['compilerOptions'];
      if (typeof opts === 'object' && opts !== null && 'strict' in opts) {
        const strict = (opts as Record<string, unknown>)['strict'];
        if (strict === true) {
          return [];
        }
      }
    }
  } catch {
    // JSON parse failed
  }

  return [{
    file: 'tsconfig.json',
    line: null,
    found: 'strict mode not enabled',
    expected: 'compilerOptions.strict: true',
    context: '',
  }];
}

/**
 * Check that a required file exists in the output directory.
 */
export function checkFileExists(
  files: string[],
  outputDir: string,
  targetFile: string,
): Evidence[] {
  const relPaths = files.map((f) => relative(outputDir, f));
  const found = relPaths.some((r) => r === targetFile || r.endsWith(`/${targetFile}`));

  if (!found) {
    return [{
      file: targetFile,
      line: null,
      found: 'file not found',
      expected: `${targetFile} must exist`,
      context: '',
    }];
  }

  return [];
}

/**
 * Check for the existence of a formatter config file.
 *
 * Looks for .prettierrc, .prettierrc.json, prettier.config.js,
 * .editorconfig, or similar formatter configuration files.
 */
export function checkFormatterConfigExists(
  files: string[],
  outputDir: string,
): Evidence[] {
  const formatterFiles = [
    '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yaml',
    '.prettierrc.yml', 'prettier.config.js', 'prettier.config.cjs',
    '.editorconfig', '.eslintrc', '.eslintrc.json', '.eslintrc.js',
    'eslint.config.js', 'eslint.config.mjs', 'biome.json',
  ];

  const relPaths = files.map((f) => basename(f));
  const hasFormatter = formatterFiles.some((cfg) => relPaths.includes(cfg));

  if (!hasFormatter) {
    return [{
      file: '.',
      line: null,
      found: 'no formatter config found',
      expected: 'formatter config file (e.g., .prettierrc, .editorconfig)',
      context: '',
    }];
  }

  return [];
}

/**
 * Check that dependency versions in package.json are pinned
 * (exact versions, no ^ or ~ prefixes).
 */
export function checkPinnedDependencies(
  outputDir: string,
): Evidence[] {
  const pkgPath = resolve(outputDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return [];
  }

  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      return [];
    }

    const evidence: Evidence[] = [];
    const pkg = parsed as Record<string, unknown>;
    const depSections = ['dependencies', 'devDependencies'] as const;

    for (const section of depSections) {
      const deps = pkg[section];
      if (typeof deps !== 'object' || deps === null) {
        continue;
      }
      for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
        if (typeof version === 'string' && /^[~^]/.test(version)) {
          evidence.push({
            file: 'package.json',
            line: null,
            found: `${name}: "${version}"`,
            expected: 'pinned version (no ^ or ~ prefix)',
            context: `${section}.${name}`,
          });
        }
      }
    }

    return evidence;
  } catch {
    return [];
  }
}
