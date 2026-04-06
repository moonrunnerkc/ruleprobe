/**
 * AST checks for export patterns.
 *
 * Detects default exports in source files.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect default exports in a source file.
 */
export function checkNamedExportsOnly(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    const declarations = defaultExport.getDeclarations();
    const firstDecl = declarations[0];
    const line = firstDecl ? getLineNumber(firstDecl) : null;
    const context = firstDecl ? getContext(firstDecl) : '';
    evidence.push({
      file: filePath,
      line,
      found: 'default export',
      expected: 'named exports only',
      context,
    });
  }

  return evidence;
}
