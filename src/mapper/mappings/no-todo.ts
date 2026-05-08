/**
 * Mapping: no-todo-comments → eslint-plugin-no-todo-comment
 *
 * Bans TODO/FIXME/HACK/XXX comments in production code.
 * Uses the `no-todo-comments` rule which is available in
 * eslint-plugin-no-todo-comment or similar packages.
 *
 * If no suitable plugin is available, falls back to a
 * no-warning-comments rule as a close approximation.
 */

import type { EslintRuleEntry } from '../types.js';

/** Map no-todo-comments pattern. */
export function mapNoTodoComments(): EslintRuleEntry {
  return {
    ruleName: 'no-warning-comments',
    severity: 'warn',
    options: [{ terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'start' }],
    sourceRuleId: '',
    description: 'No TODO/FIXME/HACK/XXX comments in production code',
  };
}