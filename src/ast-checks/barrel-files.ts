/**
 * AST check for barrel file re-exports.
 *
 * Detects index.ts files that only contain re-exports (barrel files),
 * which can cause circular dependency issues and slow builds.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Detect barrel file patterns in index.ts files.
 *
 * A barrel file is one where every statement is an export declaration
 * that re-exports from another module. Only checks files named index.ts
 * or index.js.
 */
export function checkNoBarrelFiles(sourceFile: SourceFile, filePath: string): Evidence[] {
  const fileName = sourceFile.getBaseName();
  if (fileName !== 'index.ts' && fileName !== 'index.js') {
    return [];
  }

  const statements = sourceFile.getStatements();
  if (statements.length === 0) {
    return [];
  }

  const allAreReExports = statements.every((stmt) => {
    if (stmt.getKind() === SyntaxKind.ExportDeclaration) {
      const exportDecl = stmt.asKind(SyntaxKind.ExportDeclaration);
      return exportDecl?.getModuleSpecifierValue() !== undefined;
    }
    return false;
  });

  if (allAreReExports && statements.length > 0) {
    const firstStmt = statements[0]!;
    return [{
      file: filePath,
      line: getLineNumber(firstStmt),
      found: `barrel file with ${statements.length} re-exports`,
      expected: 'no barrel files (import directly from source modules)',
      context: getContext(firstStmt),
    }];
  }

  return [];
}
