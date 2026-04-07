/**
 * AST check for function parameter count.
 *
 * Flags functions with too many parameters, which usually
 * indicates a need for an options/config object instead.
 */

import type { SourceFile } from 'ts-morph';
import type { Evidence } from '../types.js';
import { getLineNumber } from './helpers.js';

/**
 * Detect functions with too many parameters.
 *
 * @param maxParams - Maximum allowed parameters (default 4)
 */
export function checkMaxParams(
  sourceFile: SourceFile,
  filePath: string,
  maxParams: number = 4,
): Evidence[] {
  const evidence: Evidence[] = [];

  for (const func of sourceFile.getFunctions()) {
    const params = func.getParameters();
    if (params.length > maxParams) {
      const name = func.getName() ?? '<anonymous>';
      evidence.push({
        file: filePath,
        line: getLineNumber(func),
        found: `function ${name} has ${params.length} parameters`,
        expected: `max ${maxParams} parameters per function`,
        context: func.getText().split('\n')[0] ?? '',
      });
    }
  }

  for (const method of sourceFile.getClasses().flatMap((c) => c.getMethods())) {
    const params = method.getParameters();
    if (params.length > maxParams) {
      const name = method.getName();
      evidence.push({
        file: filePath,
        line: getLineNumber(method),
        found: `method ${name} has ${params.length} parameters`,
        expected: `max ${maxParams} parameters per function`,
        context: method.getText().split('\n')[0] ?? '',
      });
    }
  }

  return evidence;
}
