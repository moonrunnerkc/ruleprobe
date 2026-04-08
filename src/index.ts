/**
 * Programmatic API entry point for RuleProbe.
 *
 * Re-exports the core functions that external consumers use:
 * parsing instruction files, extracting rules, verifying output,
 * generating reports, and formatting them.
 */

import type {
  Rule,
  RuleSet,
  RuleResult,
  AdherenceReport,
  AgentRun,
  ReportSummary,
  RuleCategory,
  CategoryScore,
  InstructionFileType,
  ReportFormat,
} from './types.js';

import { parseInstructionFile } from './parsers/index.js';
import { parseMarkdown } from './parsers/markdown-parser.js';
import { extractRules as extractRulesFromSections } from './parsers/rule-extractor.js';
import { verifyOutput } from './verifier/index.js';
import type { VerifyOptions } from './verifier/index.js';
import { formatReport } from './reporter/index.js';
import type { RuleProbeConfig, CustomRule, RuleOverride } from './config/types.js';

// Re-export types for consumers
export type {
  Rule,
  RuleSet,
  RuleResult,
  AdherenceReport,
  AgentRun,
  ReportSummary,
  RuleCategory,
  CategoryScore,
  InstructionFileType,
  ReportFormat,
  VerifyOptions,
  RuleProbeConfig,
  CustomRule,
  RuleOverride,
};

// Re-export core functions
export { parseInstructionFile } from './parsers/index.js';
export { verifyOutput } from './verifier/index.js';
export { formatReport } from './reporter/index.js';
export { defineConfig, loadConfig, applyConfig } from './config/index.js';
export { extractWithLlm, createOpenAiProvider } from './llm/index.js';
export type {
  LlmProvider,
  LlmRuleCandidate,
  LlmExtractionResult,
  LlmExtractOptions,
} from './llm/index.js';
export type { OpenAiProviderConfig } from './llm/index.js';

// Agent invocation exports
export { buildAgentConfig } from './runner/agent-configs.js';
export { invokeAgent, isAgentSdkAvailable, hasAgentOutput } from './runner/agent-invoker.js';
export { watchForCompletion, countCodeFiles } from './runner/watch-mode.js';
export type { AgentInvocationConfig, RunOptions } from './runner/agent-configs.js';
export type { InvocationResult } from './runner/agent-invoker.js';
export type { WatchOptions, WatchResult } from './runner/watch-mode.js';

/**
 * Extract rules from raw markdown content.
 *
 * Parses the markdown into sections and extracts machine-verifiable rules.
 * Convenience wrapper combining parseMarkdown + extractRules.
 *
 * @param markdown - Raw markdown content
 * @param fileType - The instruction file type (used for metadata only)
 * @returns Array of extracted rules
 */
export function extractRules(markdown: string, fileType: InstructionFileType): Rule[] {
  const sections = parseMarkdown(markdown);
  const { rules } = extractRulesFromSections(sections);
  return rules;
}

/**
 * Generate a complete AdherenceReport from run metadata, ruleset, and results.
 *
 * Computes the summary statistics (total, passed, failed, warnings,
 * adherence score, per-category breakdown) from the results array.
 *
 * @param run - Agent run metadata
 * @param ruleSet - The rules that were checked
 * @param results - Individual rule results
 * @returns Complete adherence report with computed summary
 */
export function generateReport(
  run: AgentRun,
  ruleSet: RuleSet,
  results: RuleResult[],
): AdherenceReport {
  const totalRules = results.length;
  const skipped = ruleSet.rules.length - totalRules;
  const passed = results.filter((r) => r.passed).length;
  const failed = totalRules - passed;
  const warnings = results.filter(
    (r) => !r.passed && r.rule.severity === 'warning',
  ).length;
  const adherenceScore = totalRules > 0 ? (passed / totalRules) * 100 : 100;

  const categoryMap = new Map<RuleCategory, CategoryScore>();
  for (const result of results) {
    const cat = result.rule.category;
    const existing = categoryMap.get(cat) ?? { passed: 0, total: 0 };
    existing.total++;
    if (result.passed) {
      existing.passed++;
    }
    categoryMap.set(cat, existing);
  }

  const allCategories: RuleCategory[] = [
    'naming',
    'forbidden-pattern',
    'structure',
    'test-requirement',
    'import-pattern',
    'error-handling',
    'type-safety',
    'code-style',
    'dependency',
  ];
  const byCategory = {} as Record<RuleCategory, CategoryScore>;
  for (const cat of allCategories) {
    byCategory[cat] = categoryMap.get(cat) ?? { passed: 0, total: 0 };
  }

  const summary: ReportSummary = {
    totalRules,
    passed,
    failed,
    skipped,
    warnings,
    adherenceScore,
    byCategory,
  };

  return {
    run,
    ruleset: ruleSet,
    results,
    summary,
  };
}
