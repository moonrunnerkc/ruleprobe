/**
 * Batch AST verifier: runs multiple rules in a single pass over files.
 *
 * Creates one ts-morph Project, parses each file once, runs every
 * non-type-aware rule against it, then discards the SourceFile.
 * Reduces complexity from O(rules * files) to O(files) parses.
 */

import type { SourceFile } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';
import {
  createProject,
  runAstCheck,
  TYPE_AWARE_PATTERNS,
  verifyAstRule,
} from './ast-verifier.js';

/**
 * Verify multiple AST rules in a single pass over all files.
 *
 * Creates one ts-morph Project, parses each file once, and runs every
 * non-type-aware rule against it before discarding the SourceFile.
 * This reduces complexity from O(rules * files) to O(files) parses.
 * Type-aware rules are delegated to verifyAstRule individually since
 * they require a separate tsconfig-based Project.
 *
 * @param rules - All AST rules to verify
 * @param filePaths - Absolute paths to TypeScript/JavaScript files
 * @param projectPath - Optional tsconfig.json path for type-aware checks
 * @returns Map from rule to its RuleResult
 */
export function verifyAstRulesBatch(
  rules: Rule[],
  filePaths: string[],
  projectPath?: string,
): Map<Rule, RuleResult> {
  const resultMap = new Map<Rule, RuleResult>();

  // Separate type-aware rules (need their own Project) from standard rules
  const standardRules: Rule[] = [];
  for (const rule of rules) {
    const isTypeAware = TYPE_AWARE_PATTERNS.has(rule.pattern.type);
    if (isTypeAware) {
      resultMap.set(rule, verifyAstRule(rule, filePaths, projectPath));
    } else {
      standardRules.push(rule);
    }
  }

  if (standardRules.length === 0) {
    return resultMap;
  }

  // One Project, one pass over all files, all standard rules checked per file
  const project = createProject();
  const evidencePerRule = new Map<Rule, Evidence[]>();
  for (const rule of standardRules) {
    evidencePerRule.set(rule, []);
  }

  for (const fp of filePaths) {
    let sourceFile: SourceFile;
    try {
      sourceFile = project.addSourceFileAtPath(fp);
    } catch {
      for (const rule of standardRules) {
        evidencePerRule.get(rule)!.push({
          file: fp,
          line: null,
          found: 'file could not be parsed by ts-morph',
          expected: 'parseable TypeScript/JavaScript file',
          context: '',
        });
      }
      continue;
    }

    for (const rule of standardRules) {
      const evidence = runAstCheck(rule, fp, sourceFile);
      evidencePerRule.get(rule)!.push(...evidence);
    }

    // Remove the source file from the Project to bound memory usage.
    // ts-morph keeps all added files in memory; on a 7000-file codebase
    // this would exhaust heap. Removing after checks preserves O(1) memory.
    project.removeSourceFile(sourceFile);
  }

  for (const rule of standardRules) {
    const allEvidence = evidencePerRule.get(rule)!;
    resultMap.set(rule, {
      rule,
      passed: allEvidence.length === 0,
      compliance: allEvidence.length === 0 ? 1 : 0,
      evidence: allEvidence,
    });
  }

  return resultMap;
}
