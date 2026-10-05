import type { EslintRuleEntry } from '../types.js';

/** Map no-todo-comments pattern. */
export function mapNoTodoComments(): EslintRuleEntry {
  return {
    ruleName: 'no-warning-comments',
    severity: 'warn',
    options: [{ terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'anywhere' }],
    sourceRuleId: '',
    description: 'No TODO/FIXME/HACK/XXX comments in production code',
  };
}