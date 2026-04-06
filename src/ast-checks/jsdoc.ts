/**
 * AST check for JSDoc comment requirements.
 *
 * Verifies that exported functions have JSDoc comments.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber, getContext } from './helpers.js';

/**
 * Check that exported functions have JSDoc comments.
 *
 * Only checks functions with an "export" keyword. Internal functions
 * are excluded since the typical rule targets public API surface.
 */
export function checkJsDocRequired(sourceFile: SourceFile, filePath: string): Evidence[] {
  const evidence: Evidence[] = [];

  for (const func of sourceFile.getFunctions()) {
    if (!func.isExported()) {
      continue;
    }

    const jsDocs = func.getJsDocs();
    if (jsDocs.length === 0) {
      const name = func.getName() ?? '<anonymous>';
      evidence.push({
        file: filePath,
        line: getLineNumber(func),
        found: `function ${name} has no JSDoc`,
        expected: 'JSDoc comment required on exported functions',
        context: getContext(func),
      });
    }
  }

  return evidence;
}
