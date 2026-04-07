/**
 * AST check for function length limits.
 *
 * Flags functions and methods that exceed a maximum line count.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber } from './helpers.js';

/**
 * Detect functions that exceed a maximum line count.
 *
 * Counts lines from the function's start to its end, inclusive.
 * Checks both function declarations and arrow function expressions
 * assigned to variables.
 *
 * @param maxLines - Maximum allowed lines per function (default 50)
 */
export function checkMaxFunctionLength(
  sourceFile: SourceFile,
  filePath: string,
  maxLines: number = 50,
): Evidence[] {
  const evidence: Evidence[] = [];

  for (const func of sourceFile.getFunctions()) {
    const startLine = func.getStartLineNumber();
    const endLine = func.getEndLineNumber();
    const length = endLine - startLine + 1;

    if (length > maxLines) {
      const name = func.getName() ?? '<anonymous>';
      evidence.push({
        file: filePath,
        line: getLineNumber(func),
        found: `function ${name}: ${length} lines`,
        expected: `max ${maxLines} lines per function`,
        context: `function ${name}() { ... } (${length} lines)`,
      });
    }
  }

  for (const method of sourceFile.getClasses().flatMap((c) => c.getMethods())) {
    const startLine = method.getStartLineNumber();
    const endLine = method.getEndLineNumber();
    const length = endLine - startLine + 1;

    if (length > maxLines) {
      const name = method.getName();
      evidence.push({
        file: filePath,
        line: getLineNumber(method),
        found: `method ${name}: ${length} lines`,
        expected: `max ${maxLines} lines per function`,
        context: `${name}() { ... } (${length} lines)`,
      });
    }
  }

  return evidence;
}
