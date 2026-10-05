/**
 * Mapping: console restrictions → ESLint rules
 *
 * Bans console statements in production code.
 * The extended variant bans all console methods;
 * the basic variant bans only console.log.
 */

import type { EslintRuleEntry } from '../types.js';

/** Restrict console.log without banning other console methods. */
export function mapNoConsoleLog(): EslintRuleEntry {
  return {
    ruleName: 'no-restricted-syntax',
    severity: 'error',
    options: [{
      selector: "MemberExpression[object.name='console'][property.name='log'], MemberExpression[object.name='console'][computed=true][property.value='log']",
      message: 'console.log is not allowed.',
    }],
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