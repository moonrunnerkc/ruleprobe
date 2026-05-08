/**
 * Mapping: no-console-log and no-console-extended → no-console
 *
 * Bans console statements in production code.
 * The extended variant bans all console methods;
 * the basic variant bans only console.log.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-console-log to no-console with allow: []. */
export function mapNoConsoleLog(): EslintRuleEntry {
  return {
    ruleName: 'no-console',
    severity: 'error',
    options: [{ allow: [] }],
    sourceRuleId: '',
    description: 'console.log must not be used in production code',
  };
}

/** Map no-console-extended to no-console (bans all console methods). */
export function mapNoConsoleExtended(): EslintRuleEntry {
  return {
    ruleName: 'no-console',
    severity: 'error',
    sourceRuleId: '',
    description: 'Console statements must not be used',
  };
}