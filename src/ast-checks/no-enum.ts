/**
 * AST check for enum usage.
 *
 * Detects TypeScript enum declarations, since many style guides
 * prefer union types or const objects instead.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect enum declarations in source code.
 *
 * Flags any enum keyword usage. Includes both regular and const enums.
 */
export function checkNoEnum(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const enumDecl of sourceFile.getEnums()) {
    evidence.push({
      file: filePath,
      line: getLineNumber(enumDecl),
      found: `enum ${enumDecl.getName()}`,
      expected: 'no enums (use union types or const objects)',
      context: getContext(enumDecl),
    });
  }

  return evidence;
}
