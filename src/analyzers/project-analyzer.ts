/**
 * Multi-file project analysis.
 *
 * Discovers instruction files in a project directory, parses each,
 * detects cross-file conflicts and redundancies, and produces
 * a unified ProjectAnalysis.
 */

import { existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type {
  ProjectAnalysis,
  FileAnalysis,
  CrossFileConflict,
  CrossFileRedundancy,
  RuleCategory,
  ReportSummary,
  CategoryScore,
  Rule,
} from '../types.js';
import { INSTRUCTION_FILE_NAMES } from '../types.js';
import { parseInstructionFile } from '../parsers/index.js';

/**
 * Discover instruction files in a project directory.
 *
 * Checks for each known instruction file name at the project root.
 *
 * @param projectDir - Root directory of the project
 * @returns Array of absolute paths to found instruction files
 */
export function discoverInstructionFiles(projectDir: string): string[] {
  const found: string[] = [];
  for (const name of INSTRUCTION_FILE_NAMES) {
    const fullPath = join(projectDir, name);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      found.push(fullPath);
    }
  }
  return found;
}

/**
 * Normalize a rule's source text for deduplication.
 *
 * Strips whitespace, lowercases, removes punctuation.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect cross-file conflicts.
 *
 * Two rules conflict when they have matching pattern types but
 * incompatible expected values (e.g., one says "use pnpm", another
 * says "use yarn" for the same type 'package-manager').
 */
function detectConflicts(
  fileAnalyses: FileAnalysis[],
): CrossFileConflict[] {
  const conflicts: CrossFileConflict[] = [];

  // Group rules by pattern type across all files
  const rulesByType = new Map<string, Array<{ file: string; rule: Rule }>>();

  for (const fa of fileAnalyses) {
    for (const rule of fa.ruleSet.rules) {
      const key = rule.pattern.type;
      const entries = rulesByType.get(key) ?? [];
      entries.push({ file: fa.filePath, rule });
      rulesByType.set(key, entries);
    }
  }

  // Find types where rules from different files have different expected/target values
  for (const [type, entries] of rulesByType) {
    if (entries.length < 2) continue;

    const fileGroups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const group = fileGroups.get(entry.file) ?? [];
      group.push(entry);
      fileGroups.set(entry.file, group);
    }

    if (fileGroups.size < 2) continue;

    // Compare expected and target values across files
    const expectedValues = new Map<string, Array<{ file: string; rule: Rule }>>();
    for (const entry of entries) {
      const target = String(entry.rule.pattern.target ?? '');
      const expected = String(entry.rule.pattern.expected ?? '');
      const val = `${target}::${expected}`;
      const group = expectedValues.get(val) ?? [];
      group.push(entry);
      expectedValues.set(val, group);
    }

    if (expectedValues.size > 1) {
      const conflictingRules: Array<{ file: string; rule: Rule }> = [];
      const valueDescriptions: string[] = [];

      for (const [val, group] of expectedValues) {
        conflictingRules.push(...group);
        const files = [...new Set(group.map((g) => relative('.', g.file)))];
        valueDescriptions.push(`${files.join(', ')}: "${val}"`);
      }

      conflicts.push({
        topic: type,
        rules: conflictingRules,
        description: `Conflicting ${type} rules: ${valueDescriptions.join(' vs ')}`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect cross-file redundancies.
 *
 * A redundancy occurs when the same normalized instruction text
 * appears in multiple files.
 */
function detectRedundancies(
  fileAnalyses: FileAnalysis[],
): CrossFileRedundancy[] {
  const textMap = new Map<string, Array<{ file: string; originalText: string }>>();

  for (const fa of fileAnalyses) {
    for (const rule of fa.ruleSet.rules) {
      const normalized = normalizeText(rule.source);
      if (!normalized) continue;
      const entries = textMap.get(normalized) ?? [];
      entries.push({ file: fa.filePath, originalText: rule.source });
      textMap.set(normalized, entries);
    }
  }

  const redundancies: CrossFileRedundancy[] = [];
  for (const [normalized, occurrences] of textMap) {
    const uniqueFiles = new Set(occurrences.map((o) => o.file));
    if (uniqueFiles.size > 1) {
      redundancies.push({ normalizedText: normalized, occurrences });
    }
  }

  return redundancies;
}

/**
 * Build a coverage map: category to list of files containing rules in that category.
 */
function buildCoverageMap(
  fileAnalyses: FileAnalysis[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  for (const fa of fileAnalyses) {
    for (const rule of fa.ruleSet.rules) {
      const cat = rule.category;
      if (!map[cat]) {
        map[cat] = [];
      }
      if (!map[cat].includes(fa.filePath)) {
        map[cat].push(fa.filePath);
      }
    }
  }

  return map;
}

/**
 * Analyze a project directory for all instruction files.
 *
 * Discovers instruction files, parses each, detects conflicts
 * and redundancies, and returns a complete ProjectAnalysis.
 *
 * @param projectDir - Root directory of the project
 * @returns ProjectAnalysis with per-file results and cross-file analysis
 */
export function analyzeProject(projectDir: string): ProjectAnalysis {
  const instructionPaths = discoverInstructionFiles(projectDir);

  const files: FileAnalysis[] = instructionPaths.map((filePath) => {
    const ruleSet = parseInstructionFile(filePath);
    const fileType = ruleSet.sourceType;
    return {
      filePath,
      fileType,
      ruleSet,
      results: [], // populated after verification
    };
  });

  const conflicts = detectConflicts(files);
  const redundancies = detectRedundancies(files);
  const coverageMap = buildCoverageMap(files);

  // Aggregate summary
  const allRules = files.flatMap((f) => f.ruleSet.rules);
  const totalRules = allRules.length;
  const allCategories: RuleCategory[] = [
    'naming', 'forbidden-pattern', 'structure', 'test-requirement',
    'import-pattern', 'error-handling', 'type-safety', 'code-style',
    'dependency', 'preference', 'file-structure', 'tooling', 'testing',
  ];
  const byCategory = {} as Record<RuleCategory, CategoryScore>;
  for (const cat of allCategories) {
    const catRules = allRules.filter((r) => r.category === cat);
    byCategory[cat] = { passed: 0, total: catRules.length };
  }

  const summary: ReportSummary = {
    totalRules,
    passed: 0,
    failed: 0,
    skipped: 0,
    warnings: 0,
    adherenceScore: 0,
    byCategory,
  };

  return {
    projectDir,
    files,
    conflicts,
    redundancies,
    coverageMap,
    summary,
  };
}
