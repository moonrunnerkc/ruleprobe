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

/** Pattern types with no ESLint equivalent. */
const UNMAPPABLE_TYPES: Record<string, string> = {
  'test-files-exist': 'No ESLint rule enforces test file existence; use a project-level script or CI check instead.',
  'test-file-naming': 'No ESLint rule enforces test file naming conventions across the project.',
  'test-colocation': 'No ESLint rule enforces test file colocation with source files.',
  'describe-it-structure': 'No ESLint rule enforces describe/it block structure in test files.',
  'no-console-in-tests': 'No ESLint rule restricts console usage specifically in test files (no-console applies globally).',
  'no-setTimeout-in-tests': 'No ESLint rule restricts setTimeout specifically in test files.',
  'no-test-only': 'No ESLint rule restricts .only() in test files without a test-framework-specific plugin.',
  'no-test-skip': 'No ESLint rule restricts .skip() in test files without a test-framework-specific plugin.',
  'strict-mode': 'TypeScript strict mode is a tsconfig setting, not an ESLint rule; use @tsconfig/strict or set strict: true in tsconfig.json.',
  'typescript-required': 'TypeScript adoption is a project configuration choice, not an ESLint rule.',
  'package-manager': 'Package manager choice (npm, pnpm, yarn) is enforced by project config, not ESLint.',
  'test-framework': 'Test framework choice is a project dependency, not an ESLint rule.',
  'tool-present': 'Tool presence (eslint, prettier, biome) is a project dependency, not an ESLint rule.',
  'ci-command-present': 'CI configuration is a GitHub Actions/workflow concern, not an ESLint rule.',
  'ci-config-present': 'CI configuration existence is a project setup concern, not an ESLint rule.',
  'pre-commit-check': 'Pre-commit hooks are configured via husky/lefthook, not ESLint.',
  'git-hook-present': 'Git hooks are configured via husky/lefthook, not ESLint.',
  'script-present': 'npm scripts are package.json config, not an ESLint rule.',
  'env-tool-present': 'Environment tooling (flox, nix, devcontainer) is project setup, not an ESLint rule.',
  'readme-exists': 'File existence checks are project-level concerns, not ESLint rules.',
  'changelog-exists': 'File existence checks are project-level concerns, not ESLint rules.',
  'formatter-config-exists': 'Config file existence is a project-level concern, not ESLint rules.',
  'pinned-dependencies': 'Dependency version pinning is enforced by npm/Renovabot, not ESLint.',
  'banned-import': 'Can be approximated with no-restricted-imports, but requires manual config per banned package.',
  'directory-exists-with-files': 'Directory structure checks are project-level concerns, not ESLint rules.',
  'file-pattern-exists': 'File existence checks are project-level concerns, not ESLint rules.',
  'module-index-required': 'Module index file checks are project-level concerns, not ESLint rules.',
  'python-snake-case': 'Python naming conventions are handled by Python linters (e.g. flake8, ruff), not ESLint.',
  'python-class-naming': 'Python naming conventions are handled by Python linters, not ESLint.',
  'go-naming': 'Go naming conventions are handled by Go linters (e.g. golint), not ESLint.',
  'function-length': 'Language-specific function length checks (Python/Go) are not ESLint rules.',
  'conventional-commits': 'Commit message format is enforced by commitlint, not ESLint.',
  'commit-message-prefix': 'Commit message format is enforced by commitlint, not ESLint.',
  'branch-naming': 'Branch naming conventions are enforced by git hooks, not ESLint.',
  'signed-commits': 'Commit signing is a git configuration, not an ESLint rule.',
  'commit-message-pattern': 'Commit message format is enforced by commitlint, not ESLint.',
  'no-unresolved-imports': 'Import resolution requires eslint-plugin-import with TypeScript resolver config.',
  'prefer-pair': 'Preference rules (prefer X over Y) require contextual enforcement; no direct ESLint mapping.',
  'async-try-catch': 'Async try/catch enforcement has no direct ESLint rule; use @typescript-eslint/require-await as partial coverage.',
  'error-log-context': 'Error logging context has no ESLint rule; use custom eslint plugin or project-level convention.',
  'kebab-case-directories': 'Directory naming conventions are project-level, not ESLint rules.',
  'concise-conditionals': 'No ESLint rule enforces optional braces in single-statement conditionals.',
  'barrel-files': 'No ESLint rule bans barrel files; use @typescript-eslint/no-reexport or project convention.',
};

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