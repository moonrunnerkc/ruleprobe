/**
 * RuleProbe-to-ESLint config mapper.
 *
 * Takes a RuleSet (parsed from an instruction file) and produces an
 * EslintConfig with mappable ESLint rule entries and unmappable rules
 * annotated with reasons.
 *
 * Naming conventions are merged: pascalcase-types, camelcase-variables,
 * and upper-case-constants all map into a single
 * @typescript-eslint/naming-convention config.
 */

import type { RuleSet, Rule } from '../types.js';
import type { EslintConfig, EslintRuleEntry, EslintSeverity, UnmappableRule } from './types.js';
import { UNMAPPABLE_TYPES } from '../mappings/index.js';
import { mapNoAny } from './mappings/no-any.js';
import { mapNamedExports } from './mappings/named-exports.js';
import { mapKebabCaseFiles } from './mappings/kebab-case-files.js';
import { mapMaxFileLines, mapMaxLineLength } from './mappings/max-lines.js';
import { mapNoConsoleLog, mapNoConsoleExtended } from './mappings/no-console.js';
import { mapJsdocRequired } from './mappings/jsdoc-required.js';
import {
  resetNamingAccumulator,
  addNamingPattern,
  hasNamingEntries,
  buildNamingConventionRule,
} from './mappings/naming-convention.js';
import {
  mapNoVar,
  mapPreferConst,
  mapNoElseAfterReturn,
  mapNoNestedTernary,
  mapNoMagicNumbers,
  mapConsistentSemicolons,
  mapQuoteStyle,
} from './mappings/code-style.js';
import { mapNoEmptyCatch, mapThrowErrorOnly } from './mappings/error-handling.js';
import {
  mapNoEnum,
  mapNoTypeAssertions,
  mapNonNullAssertions,
  mapNoImplicitAny,
  mapNoUnusedExports,
  mapNoTsDirectives,
} from './mappings/type-safety.js';
import { mapMaxFunctionLength, mapMaxParams } from './mappings/function-limits.js';
import {
  mapNoWildcardExports,
  mapNoNamespaceImports,
  mapNoPathAliases,
  mapNoDeepRelativeImports,
} from './mappings/imports.js';
import { mapNoTodoComments } from './mappings/no-todo.js';

/** Pattern types that are handled by the naming-convention merger. */
const NAMING_PATTERN_TYPES = new Set(['PascalCase', 'camelCase', 'UPPER_CASE']);

/** Pattern types with no ESLint equivalent. Imported from mappings module. */

/**
 * Map a single RuleProbe rule to an ESLint rule entry.
 *
 * Returns an EslintRuleEntry if the rule can be mapped, or null if
 * it needs special handling (e.g. naming conventions are merged).
 */
function mapRule(rule: Rule): EslintRuleEntry | null {
  const { type, expected } = rule.pattern;
  const severity: EslintSeverity = rule.severity === 'error' ? 'error' : 'warn';

  // Naming convention rules are handled separately via the accumulator
  if (NAMING_PATTERN_TYPES.has(type)) {
    return null;
  }

  switch (type) {
    // no-any
    case 'no-any':
      return { ...mapNoAny(), severity, sourceRuleId: rule.id, description: rule.description };

    // no-console
    case 'no-console-log':
      return { ...mapNoConsoleLog(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-console-extended':
      return { ...mapNoConsoleExtended(), severity, sourceRuleId: rule.id, description: rule.description };

    // named-exports
    case 'named-exports-only':
      return { ...mapNamedExports(), severity, sourceRuleId: rule.id, description: rule.description };

    // kebab-case files
    case 'kebab-case':
      return { ...mapKebabCaseFiles(), severity, sourceRuleId: rule.id, description: rule.description };

    // max-lines
    case 'max-file-length':
      return { ...mapMaxFileLines(expected), severity, sourceRuleId: rule.id, description: rule.description };
    case 'max-line-length':
      return { ...mapMaxLineLength(expected), severity, sourceRuleId: rule.id, description: rule.description };

    // jsdoc
    case 'jsdoc-required':
      return { ...mapJsdocRequired(), severity, sourceRuleId: rule.id, description: rule.description };

    // code style
    case 'no-var':
      return { ...mapNoVar(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'prefer-const':
      return { ...mapPreferConst(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-else-after-return':
      return { ...mapNoElseAfterReturn(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-nested-ternary':
      return { ...mapNoNestedTernary(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-magic-numbers':
      return { ...mapNoMagicNumbers(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'consistent-semicolons':
      return { ...mapConsistentSemicolons(expected), severity, sourceRuleId: rule.id, description: rule.description };
    case 'quote-style':
      return { ...mapQuoteStyle(expected), severity, sourceRuleId: rule.id, description: rule.description };

    // error handling
    case 'no-empty-catch':
      return { ...mapNoEmptyCatch(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'throw-error-only':
      return { ...mapThrowErrorOnly(), severity, sourceRuleId: rule.id, description: rule.description };

    // type safety
    case 'no-enum':
      return { ...mapNoEnum(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-type-assertions':
      return { ...mapNoTypeAssertions(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-non-null-assertions':
      return { ...mapNonNullAssertions(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-implicit-any':
      return { ...mapNoImplicitAny(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-unused-exports':
      return { ...mapNoUnusedExports(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-ts-directives':
      return { ...mapNoTsDirectives(), severity, sourceRuleId: rule.id, description: rule.description };

    // function limits
    case 'max-function-length':
      return { ...mapMaxFunctionLength(expected), severity, sourceRuleId: rule.id, description: rule.description };
    case 'max-params':
      return { ...mapMaxParams(expected), severity, sourceRuleId: rule.id, description: rule.description };

    // imports
    case 'no-wildcard-exports':
      return { ...mapNoWildcardExports(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-namespace-imports':
      return { ...mapNoNamespaceImports(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-path-aliases':
      return { ...mapNoPathAliases(), severity, sourceRuleId: rule.id, description: rule.description };
    case 'no-deep-relative-imports':
      return { ...mapNoDeepRelativeImports(expected), severity, sourceRuleId: rule.id, description: rule.description };

    // comments
    case 'no-todo-comments':
      return { ...mapNoTodoComments(), severity, sourceRuleId: rule.id, description: rule.description };

    default:
      return null;
  }
}

/**
 * Map a RuleSet to an EslintConfig.
 *
 * Iterates all rules in the RuleSet, mapping each to an ESLint rule
 * entry where possible. Naming conventions are merged into a single
 * @typescript-eslint/naming-convention config. Rules with no ESLint
 * equivalent are collected as UnmappableRule entries with reasons.
 *
 * @param ruleSet - The parsed RuleSet from an instruction file
 * @returns An EslintConfig with mappable rules, unmappable rules, and required plugins
 */
export function mapRuleSetToEslintConfig(ruleSet: RuleSet): EslintConfig {
  resetNamingAccumulator();

  const rules: EslintRuleEntry[] = [];
  const unmappable: UnmappableRule[] = [];

  for (const rule of ruleSet.rules) {
    const { type } = rule.pattern;

    // Naming convention rules are accumulated and merged
    if (NAMING_PATTERN_TYPES.has(type)) {
      addNamingPattern(type, rule.id);
      continue;
    }

    const entry = mapRule(rule);
    if (entry) {
      rules.push(entry);
    } else {
      // Check if we have a known reason for this pattern type
      const reason = UNMAPPABLE_TYPES[type] ?? `No ESLint rule enforces "${type}" constraints.`;
      unmappable.push({
        sourceRuleId: rule.id,
        sourceText: rule.source,
        reason,
      });
    }
  }

  // Add the merged naming convention rule if any naming rules were found
  if (hasNamingEntries()) {
    rules.push(buildNamingConventionRule());
  }

  // Deduplicate plugins
  const plugins = [...new Set(
    rules
      .map((r) => r.plugin)
      .filter((p): p is string => p !== undefined),
  )];

  return {
    rules,
    unmappable,
    plugins,
    sourceFile: ruleSet.sourceFile,
  };
}