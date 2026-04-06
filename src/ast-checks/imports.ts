/**
 * AST checks for import patterns.
 *
 * Detects deep relative imports and path alias usage.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence } from './helpers.js';

/**
 * Check for relative imports that go deeper than the allowed level.
 *
 * Counts the number of "../" segments in import paths. A depth of 2
 * means "../../" is the maximum allowed.
 */
export function checkNoDeepRelativeImports(
  sourceFile: SourceFile,
  filePath: string,
  maxDepth: number,
): Evidence[] {
  const evidence: Evidence[] = [];

  const importDecls = sourceFile.getImportDeclarations();
  for (const imp of importDecls) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (!moduleSpecifier.startsWith('.')) {
      continue;
    }

    const segments = moduleSpecifier.split('/').filter((s) => s === '..');
    if (segments.length > maxDepth) {
      evidence.push(
        makeEvidence(filePath, imp, moduleSpecifier, `relative import depth <= ${maxDepth}`),
      );
    }
  }

  return evidence;
}

/**
 * Determine whether an import specifier is a path alias.
 *
 * Path aliases start with @ and are not scoped npm packages.
 * Detects patterns like @/, @utils/, @components/Button.
 * Distinguishes from scoped npm packages (@types/node) using:
 * - @/ is always a path alias
 * - If any path segment has a file extension, it's a path alias
 * - Otherwise fall back to whether it looks like @scope/package
 */
function isPathAlias(specifier: string): boolean {
  if (!specifier.startsWith('@')) {
    return false;
  }
  if (specifier.startsWith('@/')) {
    return true;
  }
  if (/\.[a-z]{1,4}$/.test(specifier)) {
    return true;
  }
  if (/^@[a-z][a-z0-9.-]*\/[a-z][a-z0-9.-]*$/.test(specifier)) {
    return false;
  }
  return /^@[a-zA-Z]/.test(specifier);
}

/**
 * Check for path alias imports (e.g. @/ or @utils/).
 *
 * Flags any import whose module specifier starts with "@"
 * followed by a "/" (distinguishing from scoped npm packages).
 */
export function checkNoPathAliases(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const importDecls = sourceFile.getImportDeclarations();
  for (const imp of importDecls) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (!isPathAlias(moduleSpecifier)) {
      continue;
    }
    evidence.push(
      makeEvidence(filePath, imp, moduleSpecifier, 'relative paths only, no path aliases'),
    );
  }

  return evidence;
}
