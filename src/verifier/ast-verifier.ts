/**
 * AST-based verifier using ts-morph. Composes per-file dispatch from
 * ast-check-dispatch.ts with optional type-aware verification from
 * ast-verifier-type-aware.ts.
 */

import { Project } from 'ts-morph';
import type { Rule, RuleResult, Evidence } from '../types.js';
import { runAstCheck, isSkipMarker } from './ast-check-dispatch.js';
import { TYPE_AWARE_PATTERNS, verifyTypeAwareRule } from './ast-verifier-type-aware.js';

export { runAstCheck, isSkipMarker, TYPE_AWARE_PATTERNS };

/** Create a ts-morph Project for parsing without compilation. */
export function createProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
}

/**
 * Verify a rule against all TypeScript/JavaScript files.
 *
 * Loads all matching files into a ts-morph Project and runs the
 * appropriate AST check. Files that fail to parse are recorded as
 * evidence rather than aborting the run. Type-aware checks delegate
 * to verifyTypeAwareRule when a project path is supplied; without
 * one they skip cleanly.
 *
 * @param rule - The rule to verify
 * @param filePaths - Absolute paths to the files to check
 * @param projectPath - Optional tsconfig.json path for type-aware checks
 * @returns A RuleResult with pass/fail and evidence
 */
export function verifyAstRule(
  rule: Rule,
  filePaths: string[],
  projectPath?: string,
): RuleResult {
  const isTypeAware = TYPE_AWARE_PATTERNS.has(rule.pattern.type);

  if (isTypeAware && !projectPath) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: '',
        line: null,
        found: 'skipped (requires --project flag with tsconfig.json path)',
        expected: rule.pattern.type,
        context: '',
      }],
    };
  }

  if (isTypeAware && projectPath) {
    return verifyTypeAwareRule(rule, filePaths, projectPath);
  }

  const project = createProject();
  const allEvidence: Evidence[] = [];
  let skipped = false;

  for (const fp of filePaths) {
    try {
      const sourceFile = project.addSourceFileAtPath(fp);
      const evidence = runAstCheck(rule, fp, sourceFile);
      if (isSkipMarker(evidence)) {
        skipped = true;
        continue;
      }
      allEvidence.push(...evidence);
    } catch {
      allEvidence.push({
        file: fp,
        line: null,
        found: 'file could not be parsed by ts-morph',
        expected: 'parseable TypeScript/JavaScript file',
        context: '',
      });
    }
  }

  if (skipped && allEvidence.length === 0) {
    return {
      rule,
      passed: false,
      compliance: 0,
      evidence: [],
      skipped: true,
    };
  }

  return {
    rule,
    passed: allEvidence.length === 0,
    compliance: allEvidence.length === 0 ? 1 : 0,
    evidence: allEvidence,
  };
}
