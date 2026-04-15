/**
 * Preference verifier.
 *
 * Counts occurrences of preferred vs alternative patterns in code
 * files using ts-morph AST analysis. Returns compliance as a ratio
 * of preferred / (preferred + alternative).
 */

import { Project, type SourceFile } from 'ts-morph';
import { extname } from 'node:path';
import type { Rule, RuleResult, Evidence } from '../types.js';
import { PREFER_PAIRS } from './prefer-pairs.js';
import { countInFile } from './prefer-pair-counters.js';
import type { ExclusionCount } from './exclusion-definitions.js';
import { EXCLUSION_REGISTRY } from './exclusion-definitions.js';
import { countPathExclusions } from './path-exclusions.js';

/**
 * Count excluded instances for a pair in a source file.
 *
 * @param pairId - ID of the prefer-pair
 * @param sourceFile - The source file to analyze
 * @returns Exclusion count with breakdown
 */
function countExclusionsInFile(pairId: string, sourceFile: SourceFile): ExclusionCount {
  const exclusions = EXCLUSION_REGISTRY.get(pairId);
  if (!exclusions || exclusions.length === 0) {
    return { total: 0, breakdown: [] };
  }

  let total = 0;
  const breakdown: ExclusionCount['breakdown'] = [];

  for (const excl of exclusions) {
    const count = excl.count(sourceFile);
    if (count > 0) {
      total += count;
      breakdown.push({ label: excl.label, count, reason: excl.reason });
    }
  }

  return { total, breakdown };
}

/**
 * Create a ts-morph Project for parsing without compilation.
 */
function createProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
      jsx: 2, // React
      noEmit: true,
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
}

/**
 * Verify a preference rule by counting preferred vs alternative occurrences.
 *
 * Scans all matching files, totals the counts, applies exclusions for
 * structurally justified uses of the non-preferred pattern, and returns
 * compliance as preferred / (preferred + alternative - excluded).
 *
 * @param rule - The preference rule to verify
 * @param filePaths - Paths to source files to scan
 * @param threshold - Compliance threshold for pass/fail (default: 0.8)
 * @param projectDir - Project root for path-based exclusions (optional)
 * @returns RuleResult with compliance ratio including exclusion data
 */
export function verifyPreferenceRule(
  rule: Rule,
  filePaths: string[],
  threshold: number = 0.8,
  projectDir?: string,
): RuleResult {
  const pairId = rule.pattern.target;
  const pair = PREFER_PAIRS.find((p) => p.id === pairId);

  if (!pair) {
    return {
      rule,
      passed: true,
      compliance: 1,
      evidence: [{
        file: '',
        line: null,
        found: `prefer-pair "${pairId}" not yet verifiable`,
        expected: 'known prefer-pair',
        context: '',
      }],
    };
  }

  const relevantExts = new Set(pair.extensions);
  const relevantFiles = filePaths.filter((f) => relevantExts.has(extname(f)));

  if (relevantFiles.length === 0) {
    return { rule, passed: true, compliance: 1, evidence: [] };
  }

  const project = createProject();
  let totalPreferred = 0;
  let totalAlternative = 0;
  let totalExcluded = 0;
  const aggregateBreakdown = new Map<string, { count: number; reason: string }>();
  const evidence: Evidence[] = [];

  for (const fp of relevantFiles) {
    try {
      const sourceFile = project.addSourceFileAtPath(fp);
      const counts = countInFile(pair, sourceFile);
      totalPreferred += counts.preferred;
      totalAlternative += counts.alternative;

      const exclusions = countExclusionsInFile(pairId, sourceFile);
      totalExcluded += exclusions.total;

      for (const item of exclusions.breakdown) {
        const existing = aggregateBreakdown.get(item.label);
        if (existing) {
          existing.count += item.count;
        } else {
          aggregateBreakdown.set(item.label, { count: item.count, reason: item.reason });
        }
      }

      if (counts.alternative > 0) {
        const exclNote = exclusions.total > 0
          ? ` (${exclusions.total} excluded)`
          : '';
        evidence.push({
          file: fp,
          line: null,
          found: `${counts.alternative} ${pair.alternativeLabel}${exclNote}, ${counts.preferred} ${pair.preferredLabel}`,
          expected: pair.preferredLabel,
          context: `${pair.preferredLabel} preferred over ${pair.alternativeLabel}`,
        });
      }

      project.removeSourceFile(sourceFile);
    } catch {
      // Skip files that can't be parsed
    }
  }

  if (pairId === 'named-vs-default-exports' && projectDir) {
    const pathExcl = countPathExclusions(relevantFiles, projectDir);
    totalExcluded += pathExcl.excluded;
    for (const item of pathExcl.breakdown) {
      const existing = aggregateBreakdown.get(item.label);
      if (existing) {
        existing.count += item.count;
      } else {
        aggregateBreakdown.set(item.label, { count: item.count, reason: item.reason });
      }
    }
  }

  const adjustedDenominator = totalPreferred + totalAlternative - totalExcluded;
  const compliance = adjustedDenominator <= 0 ? 1 : totalPreferred / adjustedDenominator;
  const passed = compliance >= threshold;

  if (totalExcluded > 0) {
    const parts: string[] = [];
    for (const [label, data] of aggregateBreakdown) {
      parts.push(`${label}: ${data.count}`);
    }
    evidence.push({
      file: '',
      line: null,
      found: `${totalExcluded} ${pair.alternativeLabel} excluded (${parts.join(', ')})`,
      expected: 'structurally justified exclusions',
      context: `Excluded instances are removed from the violation denominator`,
    });
  }

  return { rule, passed, compliance, evidence };
}
