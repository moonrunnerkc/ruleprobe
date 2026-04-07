/**
 * AST check for namespace (wildcard) imports.
 *
 * Detects "import * as name" syntax which imports entire modules
 * and can defeat tree-shaking.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence } from './helpers.js';

/**
 * Detect namespace imports (import * as x).
 *
 * Flags import declarations that use a namespace import.
 */
export function checkNoNamespaceImports(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const imp of sourceFile.getImportDeclarations()) {
    const namespaceImport = imp.getNamespaceImport();
    if (namespaceImport) {
      evidence.push(
        makeEvidence(filePath, imp, imp.getText(), 'no namespace imports (import * as)'),
      );
    }
  }

  return evidence;
}
