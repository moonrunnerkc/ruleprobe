/**
 * Mapping: naming rules → @typescript-eslint/naming-convention
 *
 * Merges multiple naming conventions (camelCase variables, PascalCase types,
 * UPPER_CASE constants) into a single naming-convention rule config.
 */

import type { EslintRuleEntry } from '../types.js';

/** Selector and format for a naming convention entry. */
interface NamingEntry {
  selector: string;
  format: string[];
  modifiers?: string[];
  leadingUnderscore?: string;
  filter?: string;
}

/** Map PascalCase types pattern to naming-convention entries. */
function pascalCaseTypes(): NamingEntry[] {
  return [
    { selector: 'class', format: ['PascalCase'] },
    { selector: 'interface', format: ['PascalCase'] },
    { selector: 'typeAlias', format: ['PascalCase'] },
    { selector: 'enum', format: ['PascalCase'] },
    { selector: 'enumMember', format: ['PascalCase'] },
  ];
}

/** Map camelCase variables/functions pattern to naming-convention entries. */
function camelCaseVariables(): NamingEntry[] {
  return [
    {
      selector: 'variable',
      format: ['camelCase', 'UPPER_CASE'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'function',
      format: ['camelCase'],
    },
    {
      selector: 'parameter',
      format: ['camelCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'classMethod',
      format: ['camelCase'],
    },
    {
      selector: 'classProperty',
      format: ['camelCase', 'UPPER_CASE'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'objectLiteralProperty',
      format: ['camelCase', 'UPPER_CASE'],
    },
    {
      selector: 'typeProperty',
      format: ['camelCase', 'UPPER_CASE'],
    },
  ];
}

/** Map UPPER_CASE constants pattern to naming-convention entries. */
function upperCaseConstants(): NamingEntry[] {
  return [
    {
      selector: 'variable',
      modifiers: ['const'],
      format: ['camelCase', 'UPPER_CASE'],
      leadingUnderscore: 'allow',
    },
  ];
}

/** Map camelCase identifiers (general) to naming-convention entries. */
function camelCaseGeneral(): NamingEntry[] {
  return [
    {
      selector: 'default',
      format: ['camelCase'],
      leadingUnderscore: 'allow',
    },
  ];
}

/** Build naming-convention options from accumulated entries. */
function buildNamingOptions(entries: NamingEntry[]): unknown[] {
  const rules = entries.map((entry) => {
    const rule: Record<string, unknown> = {
      selector: entry.selector,
      format: entry.format,
    };
    if (entry.modifiers) {
      rule['modifiers'] = entry.modifiers;
    }
    if (entry.leadingUnderscore) {
      rule['leadingUnderscore'] = entry.leadingUnderscore;
    }
    if (entry.filter) {
      rule['filter'] = entry.filter;
    }
    return rule;
  });
  return [{ rules }];
}

/** Accumulated naming entries for merging. */
let namingEntries: NamingEntry[] = [];

/** Source rule IDs that contributed to naming-convention. */
let namingSourceIds: string[] = [];

/** Reset accumulated naming entries. Called before processing a RuleSet. */
export function resetNamingAccumulator(): void {
  namingEntries = [];
  namingSourceIds = [];
}

/**
 * Add naming entries for a given pattern type.
 *
 * Returns true if the pattern type was handled, false otherwise.
 */
export function addNamingPattern(
  patternType: string,
  sourceRuleId: string,
): boolean {
  switch (patternType) {
    case 'PascalCase':
      namingEntries.push(...pascalCaseTypes());
      namingSourceIds.push(sourceRuleId);
      return true;
    case 'camelCase':
      if (namingSourceIds.length === 0) {
        // First camelCase rule: use general selectors
        namingEntries.push(...camelCaseVariables());
      }
      namingSourceIds.push(sourceRuleId);
      return true;
    case 'UPPER_CASE':
      namingEntries.push(...upperCaseConstants());
      namingSourceIds.push(sourceRuleId);
      return true;
    default:
      return false;
  }
}

/** Whether any naming entries have been accumulated. */
export function hasNamingEntries(): boolean {
  return namingEntries.length > 0;
}

/** Build the merged naming-convention rule entry from accumulated entries. */
export function buildNamingConventionRule(): EslintRuleEntry {
  // If we only have camelCase, use general selectors instead of specific ones
  const uniqueTypes = new Set(namingEntries.map((e) => e.format.join(',')));
  const entries = namingEntries.length > 0 ? namingEntries : camelCaseGeneral();
  const options = buildNamingOptions(entries);

  return {
    ruleName: '@typescript-eslint/naming-convention',
    plugin: '@typescript-eslint',
    severity: 'error',
    options,
    sourceRuleId: namingSourceIds.join(', '),
    description: 'Naming conventions for TypeScript identifiers',
  };
}