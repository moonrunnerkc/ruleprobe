/**
 * ESLint config to CLAUDE.md rules section extractor.
 *
 * Takes a parsed ESLint config and emits a markdown rules section.
 * Each ESLint rule is reverse-mapped to a one-line prose instruction.
 * Subjective/stylistic rules without a prose equivalent are emitted
 * as skipped comments.
 */

import type { ParsedEslintConfig } from '../drift/types.js';
import { findByEslintRuleName, findAllByEslintRuleName } from '../mappings/index.js';
import { getProseForRule, isStylisticRule } from '../mappings/prose-templates.js';

/** A rule that was reverse-mapped to a prose instruction. */
export interface ExtractedRule {
  /** The one-line prose instruction. */
  prose: string;
  /** The ESLint rule name that produced this instruction. */
  eslintRuleName: string;
  /** The RuleProbe pattern type, if a reverse mapping exists. */
  patternType: string | null;
}

/** A rule that was skipped during extraction. */
export interface SkippedRule {
  /** The ESLint rule name. */
  eslintRuleName: string;
  /** Why the rule was skipped. */
  reason: 'stylistic' | 'no-mapping' | 'off';
  /** The severity from the config (for context). */
  severity: string;
}

/** The result of extracting rules from an ESLint config. */
export interface ExtractionResult {
  /** Successfully extracted prose instructions. */
  rules: ExtractedRule[];
  /** Rules that were skipped with reasons. */
  skipped: SkippedRule[];
  /** Path to the source ESLint config file. */
  sourceFile: string;
}

/**
 * Extract prose rules from a parsed ESLint config.
 *
 * For each rule in the config:
 * - If severity is "off", skip it
 * - If the rule maps to a RuleProbe pattern, generate prose
 * - If the rule is stylistic, mark it as skipped
 * - If no mapping exists, mark it as skipped
 *
 * @param config - A parsed ESLint config
 * @returns An ExtractionResult with extracted rules and skipped rules
 */
export function extractRules(config: ParsedEslintConfig): ExtractionResult {
  const rules: ExtractedRule[] = [];
  const skipped: SkippedRule[] = [];

  // Track which naming convention selectors we've already emitted prose for
  const seenNamingSelectors = new Set<string>();

  for (const eslintRule of config.rules) {
    // Skip disabled rules
    if (eslintRule.severity === 'off') {
      continue;
    }

    const ruleName = eslintRule.ruleName;

    // Check if this is a stylistic rule
    if (isStylisticRule(ruleName)) {
      skipped.push({
        eslintRuleName: ruleName,
        reason: 'stylistic',
        severity: eslintRule.severity,
      });
      continue;
    }

    // Try to generate prose from the template
    const prose = getProseForRule(ruleName, eslintRule.options);

    if (prose !== null) {
      // Special handling: naming-convention produces multiple prose entries
      if (ruleName === '@typescript-eslint/naming-convention') {
        const namingEntries = extractNamingEntries(eslintRule.options);
        for (const entry of namingEntries) {
          if (!seenNamingSelectors.has(entry.selector)) {
            seenNamingSelectors.add(entry.selector);
            rules.push({
              prose: entry.prose,
              eslintRuleName: ruleName,
              patternType: entry.patternType,
            });
          }
        }
        continue;
      }

      // Find the corresponding pattern type(s)
      const allMappings = findAllByEslintRuleName(ruleName);
      const patternType = allMappings.length > 0 ? allMappings[0]!.patternType : null;

      rules.push({
        prose,
        eslintRuleName: ruleName,
        patternType,
      });
      continue;
    }

    // No prose template found, check if there's a mapping entry
    const mapping = findByEslintRuleName(ruleName);
    if (mapping) {
      // There's a mapping but no prose template (shouldn't happen, but handle it)
      rules.push({
        prose: mapping.description,
        eslintRuleName: ruleName,
        patternType: mapping.patternType,
      });
      continue;
    }

    // No mapping at all
    skipped.push({
      eslintRuleName: ruleName,
      reason: 'no-mapping',
      severity: eslintRule.severity,
    });
  }

  return {
    rules,
    skipped,
    sourceFile: config.sourceFile,
  };
}

/**
 * Format an ExtractionResult as a markdown fragment.
 *
 * Produces a "## Rules" section with bullet points for each
 * extracted rule, followed by an HTML comment block listing
 * skipped rules.
 */
export function formatRulesMarkdown(result: ExtractionResult): string {
  const lines: string[] = [];

  lines.push('## Rules');
  lines.push('');

  for (const rule of result.rules) {
    lines.push(`- ${rule.prose}`);
  }

  if (result.skipped.length > 0) {
    lines.push('');
    lines.push('<!-- Skipped rules (no prose equivalent)');

    for (const skip of result.skipped) {
      const reason = skip.reason === 'stylistic'
        ? 'stylistic'
        : skip.reason === 'no-mapping'
          ? 'no RuleProbe equivalent'
          : 'disabled';
      lines.push(`  - ${skip.eslintRuleName}: ${reason}`);
    }

    lines.push('-->');
  }

  return lines.join('\n');
}

/**
 * Extract naming convention entries from ESLint rule options.
 *
 * Parses the naming-convention rule's options array and generates
 * prose entries for each selector/format combination.
 */
function extractNamingEntries(options: unknown[]): Array<{ prose: string; selector: string; patternType: string }> {
  if (options.length === 0) {
    return [{ prose: 'Enforce naming conventions for TypeScript identifiers.', selector: 'default', patternType: 'camelCase' }];
  }

  const obj = options[0];
  if (!obj || typeof obj !== 'object' || !('rules' in (obj as Record<string, unknown>))) {
    return [{ prose: 'Enforce naming conventions for TypeScript identifiers.', selector: 'default', patternType: 'camelCase' }];
  }

  const rules = (obj as Record<string, unknown>)['rules'];
  if (!Array.isArray(rules)) {
    return [{ prose: 'Enforce naming conventions for TypeScript identifiers.', selector: 'default', patternType: 'camelCase' }];
  }

  const entries: Array<{ prose: string; selector: string; patternType: string }> = [];

  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) continue;
    const r = rule as Record<string, unknown>;
    const selector = String(r['selector'] ?? 'default');
    const format = r['format'];

    if (!Array.isArray(format)) continue;

    for (const f of format) {
      const fmt = String(f);
      if (fmt === 'PascalCase') {
        const targets = pascalTargets(selector);
        entries.push({
          prose: `Use PascalCase for ${targets}.`,
          selector: `PascalCase-${selector}`,
          patternType: 'PascalCase',
        });
      } else if (fmt === 'camelCase') {
        const targets = camelTargets(selector);
        entries.push({
          prose: `Use camelCase for ${targets}.`,
          selector: `camelCase-${selector}`,
          patternType: 'camelCase',
        });
      } else if (fmt === 'UPPER_CASE') {
        const targets = upperTargets(selector);
        entries.push({
          prose: `Use UPPER_CASE for ${targets}.`,
          selector: `UPPER_CASE-${selector}`,
          patternType: 'UPPER_CASE',
        });
      }
    }
  }

  return entries.length > 0 ? entries : [{ prose: 'Enforce naming conventions for TypeScript identifiers.', selector: 'default', patternType: 'camelCase' }];
}

/** Map ESLint selector names to human-readable form for PascalCase rules. */
function pascalTargets(selector: string): string {
  const map: Record<string, string> = {
    'class': 'classes',
    'interface': 'interfaces',
    'typeAlias': 'type aliases',
    'enum': 'enums',
    'enumMember': 'enum members',
    'default': 'types and interfaces',
  };
  return map[selector] ?? selector;
}

/** Map ESLint selector names to human-readable form for camelCase rules. */
function camelTargets(selector: string): string {
  const map: Record<string, string> = {
    'variable': 'variables',
    'function': 'functions',
    'parameter': 'parameters',
    'classMethod': 'class methods',
    'classProperty': 'class properties',
    'objectLiteralProperty': 'object properties',
    'typeProperty': 'type properties',
    'default': 'variables and functions',
  };
  return map[selector] ?? selector;
}

/** Map ESLint selector names to human-readable form for UPPER_CASE rules. */
function upperTargets(selector: string): string {
  const map: Record<string, string> = {
    'variable': 'constants',
    'default': 'constants',
  };
  return map[selector] ?? selector;
}