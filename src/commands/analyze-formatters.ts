/**
 * Formatting functions for the `ruleprobe analyze` command output.
 *
 * Extracted from analyze.ts to keep files under 300 lines.
 */

import chalk from 'chalk';
import type { ProjectAnalysis, RuleCategory, CategoryScore } from '../types.js';
import type { SemanticAnalysisReport } from '../semantic/types.js';
import type { SemanticPipelineResult } from '../semantic/index.js';

/**
 * Compute summary statistics from verification results.
 */
export function computeSummary(analysis: ProjectAnalysis): typeof analysis.summary {
  const allRules = analysis.files.flatMap((f) => f.ruleSet.rules);
  const allResults = analysis.files.flatMap((f) => f.results);
  const totalRules = allRules.length;

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const result of allResults) {
    if (result.passed) {
      passed++;
    } else {
      if (result.rule.severity === 'warning') {
        warnings++;
      }
      failed++;
    }
  }

  const adherenceScore = totalRules > 0 ? (passed / totalRules) * 100 : 0;

  const allCategories: RuleCategory[] = [
    'naming', 'forbidden-pattern', 'structure', 'test-requirement',
    'import-pattern', 'error-handling', 'type-safety', 'code-style',
    'dependency', 'preference', 'file-structure', 'tooling', 'testing',
  ];
  const byCategory = {} as Record<RuleCategory, CategoryScore>;

  for (const cat of allCategories) {
    const catResults = allResults.filter((r) => r.rule.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    byCategory[cat] = { passed: catPassed, total: catResults.length };
  }

  return {
    totalRules,
    passed,
    failed,
    skipped: 0,
    warnings,
    adherenceScore,
    byCategory,
  };
}

/**
 * Compute overall compliance as average of all rule compliance scores.
 */
export function computeOverallCompliance(analysis: ProjectAnalysis): number {
  const allResults = analysis.files.flatMap((f) => f.results);
  if (allResults.length === 0) return 0;
  const sum = allResults.reduce((acc, r) => acc + r.compliance, 0);
  return sum / allResults.length;
}

/**
 * Format project analysis as JSON.
 */
export function formatJson(analysis: ProjectAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Format project analysis as human-readable text.
 */
export function formatText(analysis: ProjectAnalysis): string {
  const lines: string[] = [];

  lines.push(chalk.bold('Project Analysis'));
  lines.push(`Directory: ${analysis.projectDir}`);
  lines.push(`Instruction files found: ${analysis.files.length}`);
  lines.push('');

  for (const file of analysis.files) {
    lines.push(chalk.cyan(`  ${file.filePath}`));
    lines.push(`    Type: ${file.fileType}`);
    lines.push(`    Rules: ${file.ruleSet.rules.length}`);
    lines.push(`    Unparseable: ${file.ruleSet.unparseable.length}`);
  }

  if (analysis.files.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Rule Coverage by Category'));
    for (const [category, files] of Object.entries(analysis.coverageMap)) {
      lines.push(`  ${category}: ${files.length} file(s)`);
    }
  }

  if (analysis.conflicts.length > 0) {
    lines.push('');
    lines.push(chalk.bold.red(`Conflicts: ${analysis.conflicts.length}`));
    for (const conflict of analysis.conflicts) {
      lines.push(`  ${chalk.yellow(conflict.topic)}: ${conflict.description}`);
    }
  }

  if (analysis.redundancies.length > 0) {
    lines.push('');
    lines.push(chalk.bold.yellow(`Redundancies: ${analysis.redundancies.length}`));
    for (const r of analysis.redundancies) {
      const files = r.occurrences.map((o) => o.file).join(', ');
      lines.push(`  "${r.normalizedText}" appears in: ${files}`);
    }
  }

  lines.push('');
  lines.push(`Total rules across all files: ${analysis.summary.totalRules}`);

  return lines.join('\n');
}

/**
 * Format a brief semantic analysis summary for text output.
 */
export function formatSemanticSummary(result: SemanticPipelineResult): string {
  if (!result.performed) {
    return '';
  }
  const lines = [
    '',
    chalk.bold('Semantic Analysis'),
    `  Verdicts: ${result.verdicts.length}`,
  ];
  if (result.report) {
    lines.push(`  Fast-path: ${result.report.fastPathResolutions}`);
    lines.push(`  LLM-assisted: ${result.report.llmResolutions}`);
    lines.push(`  Token cost: ${result.report.totalTokenCost}`);
  }
  return lines.join('\n');
}

/**
 * Format a cost breakdown report for the --cost-report flag.
 */
export function formatCostReport(report: SemanticAnalysisReport): string {
  const total = report.fastPathResolutions + report.llmResolutions;
  const fastPct = total > 0 ? ((report.fastPathResolutions / total) * 100).toFixed(1) : '0.0';
  const llmPct = total > 0 ? ((report.llmResolutions / total) * 100).toFixed(1) : '0.0';

  return [
    chalk.bold('Cost Report'),
    `  Rules analyzed: ${report.rulesAnalyzed}`,
    `  Fast-path resolutions: ${report.fastPathResolutions} (${fastPct}%)`,
    `  LLM resolutions: ${report.llmResolutions} (${llmPct}%)`,
    `  Total token cost: ${report.totalTokenCost}`,
    `  Profile cache hit: ${report.profileCacheHit ? 'yes' : 'no'}`,
  ].join('\n');
}

/**
 * Format analysis as a summary table.
 */
export function formatSummary(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  const s = analysis.summary;
  const compliance = computeOverallCompliance(analysis);

  lines.push(chalk.bold('RuleProbe Summary'));
  lines.push(`Directory: ${analysis.projectDir}`);
  lines.push(`Files: ${analysis.files.length}`);
  lines.push(`Total rules: ${s.totalRules}`);
  lines.push(`Passed: ${s.passed}  Failed: ${s.failed}  Warnings: ${s.warnings}`);
  lines.push(`Overall compliance: ${(compliance * 100).toFixed(1)}%`);
  lines.push('');

  lines.push(chalk.bold('Category Breakdown'));
  for (const [cat, score] of Object.entries(s.byCategory)) {
    if (score.total > 0) {
      lines.push(`  ${cat}: ${score.passed}/${score.total}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format analysis with full detail (every rule and evidence).
 */
export function formatDetailed(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  const compliance = computeOverallCompliance(analysis);

  lines.push(chalk.bold('Project Analysis (Detailed)'));
  lines.push(`Directory: ${analysis.projectDir}`);
  lines.push(`Instruction files found: ${analysis.files.length}`);
  lines.push(`Overall compliance: ${(compliance * 100).toFixed(1)}%`);
  lines.push('');

  for (const file of analysis.files) {
    lines.push(chalk.cyan(`File: ${file.filePath}`));
    lines.push(`  Type: ${file.fileType}`);
    lines.push(`  Rules: ${file.ruleSet.rules.length}`);
    lines.push(`  Unparseable: ${file.ruleSet.unparseable.length}`);
    lines.push('');

    for (const result of file.results) {
      const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
      const complianceStr = (result.compliance * 100).toFixed(0);
      lines.push(`  ${status} [${complianceStr}%] ${result.rule.description}`);
      lines.push(`    Category: ${result.rule.category} | Qualifier: ${result.rule.qualifier}`);
      lines.push(`    Source: ${result.rule.source}`);
      if (result.rule.section) {
        lines.push(`    Section: ${result.rule.section}`);
      }

      if (result.evidence.length > 0) {
        for (const ev of result.evidence) {
          lines.push(`    ${ev.file}${ev.line !== null ? ':' + ev.line : ''}: found "${ev.found}" (expected "${ev.expected}")`);
        }
      }
      lines.push('');
    }

    if (file.ruleSet.unparseable.length > 0) {
      lines.push(chalk.yellow('  Unparseable lines:'));
      for (const u of file.ruleSet.unparseable) {
        lines.push(`    ${u}`);
      }
      lines.push('');
    }
  }

  if (analysis.conflicts.length > 0) {
    lines.push(chalk.bold.red(`Conflicts: ${analysis.conflicts.length}`));
    for (const conflict of analysis.conflicts) {
      lines.push(`  ${chalk.yellow(conflict.topic)}: ${conflict.description}`);
    }
    lines.push('');
  }

  if (analysis.redundancies.length > 0) {
    lines.push(chalk.bold.yellow(`Redundancies: ${analysis.redundancies.length}`));
    for (const r of analysis.redundancies) {
      const files = r.occurrences.map((o) => o.file).join(', ');
      lines.push(`  "${r.normalizedText}" appears in: ${files}`);
    }
    lines.push('');
  }

  lines.push(chalk.bold('Rule Coverage by Category'));
  for (const [category, files] of Object.entries(analysis.coverageMap)) {
    lines.push(`  ${category}: ${files.length} file(s)`);
  }
  lines.push('');
  lines.push(`Total rules: ${analysis.summary.totalRules}  Passed: ${analysis.summary.passed}  Failed: ${analysis.summary.failed}`);

  return lines.join('\n');
}

/**
 * Format analysis for CI output (compact, machine-friendly).
 */
export function formatCi(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  const compliance = computeOverallCompliance(analysis);
  const s = analysis.summary;

  lines.push(`rules=${s.totalRules} passed=${s.passed} failed=${s.failed} compliance=${(compliance * 100).toFixed(1)}%`);

  const allResults = analysis.files.flatMap((f) => f.results);
  for (const result of allResults) {
    if (!result.passed) {
      const severity = result.rule.severity === 'error' ? 'error' : 'warning';
      lines.push(`::${severity}::${result.rule.description} (compliance: ${(result.compliance * 100).toFixed(0)}%)`);
    }
  }

  return lines.join('\n');
}
