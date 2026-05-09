/**
 * Mapping: kebab-case filenames → unicorn/filename-case
 *
 * Enforces kebab-case for file names using the unicorn plugin.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map kebab-case filename pattern to unicorn/filename-case. */
export function mapKebabCaseFiles(): EslintRuleEntry {
  return {
    ruleName: 'unicorn/filename-case',
    plugin: 'unicorn',
    severity: 'error',
    options: [{ case: 'kebabCase' }],
    sourceRuleId: '',
    description: 'File names must use kebab-case',
  };
}