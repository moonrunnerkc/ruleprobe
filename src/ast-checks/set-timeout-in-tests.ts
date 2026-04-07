/**
 * AST check for setTimeout/setInterval in test files.
 *
 * Detects timer calls in test files, which can cause flaky tests.
 * Only applies to files ending in .test.ts or .spec.ts.
 */

import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { makeEvidence } from './helpers.js';

/**
 * Detect setTimeout and setInterval calls in test files.
 *
 * Only runs on files matching *.test.ts or *.spec.ts patterns.
 * Flags any direct call to setTimeout or setInterval.
 */
export function checkNoSetTimeoutInTests(sourceFile: SourceFile, filePath: string): Evidence[] {
  const fileName = sourceFile.getBaseName();
  const isTestFile = fileName.endsWith('.test.ts') ||
    fileName.endsWith('.spec.ts') ||
    fileName.endsWith('.test.js') ||
    fileName.endsWith('.spec.js');

  if (!isTestFile) {
    return [];
  }

  const evidence: Evidence[] = [];
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const text = call.getExpression().getText();
    if (text === 'setTimeout' || text === 'setInterval') {
      evidence.push(
        makeEvidence(filePath, call, call.getText().slice(0, 60), 'no timers in test files'),
      );
    }
  }

  return evidence;
}
