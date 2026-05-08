/**
 * Mapping: named-exports-only → import/no-default-export
 *
 * Requires named exports instead of default exports.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map named-exports-only pattern to import/no-default-export. */
export function mapNamedExports(): EslintRuleEntry {
  return {
    ruleName: 'import/no-default-export',
    plugin: 'import',
    severity: 'error',
    sourceRuleId: '',
    description: 'Only named exports are allowed, no default exports',
  };
}