/**
 * Drift comparison between CLAUDE.md-derived ESLint config and an
 * existing ESLint config file.
 *
 * Compares the two configs rule-by-rule and reports mismatches:
 * md-only, eslint-only, severity-mismatch, and config-arg-mismatch.
 * Unparseable rules from CLAUDE.md are excluded from comparison
 * since they have no ESLint equivalent to compare against.
 */

import type { EslintConfig } from '../mapper/types.js';
import type { DriftItem, DriftResult, ParsedEslintConfig } from './types.js';

/** Deep-compare two values for equality using JSON serialization. */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare a CLAUDE.md-derived ESLint config against an existing config file.
 *
 * Produces a DriftResult listing all mismatches between the two configs.
 * Rules in the unmappable list are excluded, since they have no ESLint
 * equivalent to compare against.
 *
 * @param mdConfig - The ESLint config derived from CLAUDE.md
 * @param fileConfig - The parsed ESLint config from an existing file
 * @returns A DriftResult with all detected mismatches
 */
export function compareConfigs(
  mdConfig: EslintConfig,
  fileConfig: ParsedEslintConfig,
): DriftResult {
  const items: DriftItem[] = [];

  // Build lookup for eslint file rules by name
  const fileRulesByName = new Map(
    fileConfig.rules.map((r) => [r.ruleName, r]),
  );

  // Build lookup for md rules by name (skip unmappable)
  const mdRulesByName = new Map(
    mdConfig.rules.map((r) => [r.ruleName, r]),
  );

  // Check md rules: present in md but missing/different in eslint
  for (const mdRule of mdConfig.rules) {
    const fileRule = fileRulesByName.get(mdRule.ruleName);

    if (!fileRule || fileRule.severity === 'off') {
      const relatedName = mdRule.ruleName === '@typescript-eslint/naming-convention' ? 'camelcase'
        : mdRule.ruleName === 'camelcase' ? '@typescript-eslint/naming-convention' : undefined;
      const related = relatedName && fileRulesByName.get(relatedName);
      if (related && related.severity !== 'off') {
        items.push({ kind: 'partial-match', ruleName: mdRule.ruleName, mdRuleId: mdRule.sourceRuleId,
          message: `${related.ruleName} is related to ${mdRule.ruleName}, but does not establish the same enforcement.` });
        continue;
      }
      // Rule exists in md but is absent or disabled in eslint
      items.push({
        kind: 'md-only',
        ruleName: mdRule.ruleName,
        mdRuleId: mdRule.sourceRuleId,
        mdDescription: mdRule.description,
        mdSeverity: mdRule.severity,
        eslintSeverity: fileRule?.severity,
        message: fileRule
          ? `${mdRule.ruleName} is disabled (off) in eslint config but expected ${mdRule.severity} by CLAUDE.md`
          : `${mdRule.ruleName} is in CLAUDE.md but not in eslint config`,
      });
      continue;
    }

    // Rule exists in both; check severity
    const severityDiffers = mdRule.severity !== fileRule.severity;

    // Check options
    const mdOpts = mdRule.options ?? [];
    const fileOpts = fileRule.options ?? [];
    const optionsDiffer = !deepEqual(mdOpts, fileOpts);

    if (optionsDiffer) {
      // Config-arg mismatch subsumes severity mismatch when both differ
      items.push({
        kind: 'config-arg-mismatch',
        ruleName: mdRule.ruleName,
        mdSeverity: mdRule.severity,
        eslintSeverity: fileRule.severity,
        mdOptions: mdOpts,
        eslintOptions: fileOpts,
        message: severityDiffers
          ? `${mdRule.ruleName}: CLAUDE.md says ${mdRule.severity} with ${JSON.stringify(mdOpts)}, eslint says ${fileRule.severity} with ${JSON.stringify(fileOpts)}`
          : `${mdRule.ruleName}: CLAUDE.md says ${JSON.stringify(mdOpts)}, eslint says ${JSON.stringify(fileOpts)}`,
      });
    } else if (severityDiffers) {
      items.push({
        kind: 'severity-mismatch',
        ruleName: mdRule.ruleName,
        mdSeverity: mdRule.severity,
        eslintSeverity: fileRule.severity,
        message: `${mdRule.ruleName}: CLAUDE.md says ${mdRule.severity}, eslint says ${fileRule.severity}`,
      });
    }
  }

  // Check eslint rules: present in eslint but not in md
  for (const fileRule of fileConfig.rules) {
    if (fileRule.severity === 'off') continue; // disabled rules don't count as eslint-only
    if (mdRulesByName.has(fileRule.ruleName)) continue; // already compared above

    items.push({
      kind: 'eslint-only',
      ruleName: fileRule.ruleName,
      eslintSeverity: fileRule.severity,
      message: `${fileRule.ruleName} is in eslint config but not derived from CLAUDE.md`,
    });
  }

  return {
    items,
    mdFile: mdConfig.sourceFile,
    eslintFile: fileConfig.sourceFile,
    hasDrift: items.length > 0,
    comparisonStatus: mdConfig.rules.length === 0 ? 'nothing-compared' : 'compared',
  };
}
/** Compare only the rules resolved for each checked path. */
export function compareResolvedConfigs(mdConfig: EslintConfig, configs: ParsedEslintConfig[], eslintFile: string): DriftResult {
  const items = configs.flatMap(config => compareConfigs(mdConfig, config).items.map(item => ({ ...item, filePath: config.filePath })));
  const paths = configs.flatMap(config => config.filePath ? [config.filePath] : []);
  const comparisonStatus = mdConfig.rules.length === 0 || configs.length === 0 ? 'nothing-compared'
    : configs.some(config => config.resolution === 'fallback') ? 'fallback' : 'compared';
  const coverage = mdConfig.coverage?.map(line => ({
    ...line,
    files: paths,
    enforcedOnBothSides: line.status === 'translated' ? configs.filter(config =>
      config.filePath && !config.ignored && config.resolution !== 'fallback'
      && line.ruleNames.length > 0
      && !items.some(item => item.filePath === config.filePath && item.kind !== 'eslint-only' && line.ruleNames.includes(item.ruleName)),
    ).map(config => config.filePath!) : [],
  }));
  return {
    comparisonStatus, coverage,
    items, mdFile: mdConfig.sourceFile, eslintFile, hasDrift: items.length > 0,
    pathsChecked: configs.flatMap(config => config.filePath ? [config.filePath] : []),
    resolution: configs.map(config => ({ filePath: config.filePath, mode: config.resolution ?? 'fallback', reason: config.fallbackReason })),
  };
}
