import type { RuleSet } from '../types.js';
import type { EslintRuleEntry, TranslationCoverage, UnmappableRule } from './types.js';
import { stripFormatting } from '../parsers/rule-assembler-helpers.js';

export function translationCoverage(ruleSet: RuleSet, entries: EslintRuleEntry[], unmappable: UnmappableRule[]): TranslationCoverage[] {
  const lines = ruleSet.sourceLines ?? [...new Set([...ruleSet.rules.map(rule => rule.source), ...ruleSet.unparseable])]
    .map(text => ({ text }));
  return lines.map(line => {
    const source = stripFormatting(line.text);
    const rules = ruleSet.rules.filter(rule => stripFormatting(rule.source) === source);
    const ids = new Set(rules.map(rule => rule.id));
    const mapped = entries.filter(entry => entry.sourceRuleId.split(', ').some(id => ids.has(id)));
    const unsupported = unmappable.filter(rule => ids.has(rule.sourceRuleId));
    const status = mapped.length === 0 ? 'unsupported' : unsupported.length > 0 ? 'partial' : 'translated';
    return {
      ...line,
      status,
      files: [],
      ruleNames: mapped.map(entry => entry.ruleName),
      ...(status !== 'translated' ? { reason: unsupported.map(rule => rule.reason).join(' ') || 'No complete ESLint translation for this instruction line.' } : {}),
    };
  });
}
