// Extended rule extractor tests covering additional pattern types, edge cases,
// and rule severity/category assignment.

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import { parseMarkdown } from '../../src/parsers/markdown-parser.js';
import type { Rule } from '../../src/types.js';

beforeEach(() => {
  resetRuleCounter();
});

/** Parse markdown string and extract rules. */
function extract(md: string) {
  const sections = parseMarkdown(md);
  return extractRules(sections);
}

/** Find a rule by its ID prefix. */
function findRule(rules: Rule[], idPrefix: string): Rule | undefined {
  return rules.find((r) => r.id.startsWith(idPrefix));
}

describe('extended matchers: error handling', () => {
  it('extracts "no empty catch" rule', () => {
    const { rules } = extract('# Rules\n\n- No empty catch blocks');
    const rule = findRule(rules, 'error-no-empty-catch');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('error-handling');
    expect(rule!.verifier).toBe('ast');
    expect(rule!.pattern.type).toBe('no-empty-catch');
  });

  it('matches "don\'t swallow exceptions"', () => {
    const { rules } = extract('# Rules\n\n- Don\'t swallow exceptions');
    expect(findRule(rules, 'error-no-empty-catch')).toBeDefined();
  });

  it('extracts "only throw Error objects" rule', () => {
    const { rules } = extract('# Rules\n\n- Only throw Error objects');
    const rule = findRule(rules, 'error-throw-types');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('error-handling');
    expect(rule!.pattern.type).toBe('throw-error-only');
  });

  it('matches "don\'t throw strings"', () => {
    const { rules } = extract('# Rules\n\n- Don\'t throw strings');
    expect(findRule(rules, 'error-throw-types')).toBeDefined();
  });
});

describe('extended matchers: type safety', () => {
  it('extracts "no enums" rule', () => {
    const { rules } = extract('# Rules\n\n- No enums, use union types');
    const rule = findRule(rules, 'type-no-enum');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('type-safety');
    expect(rule!.pattern.type).toBe('no-enum');
  });

  it('matches "use union types instead of enums"', () => {
    const { rules } = extract('# Rules\n\n- Use union types instead of enums');
    expect(findRule(rules, 'type-no-enum')).toBeDefined();
  });

  it('extracts "no type assertions" rule', () => {
    const { rules } = extract('# Rules\n\n- No type assertions');
    const rule = findRule(rules, 'type-no-assertions');
    expect(rule).toBeDefined();
    expect(rule!.verifier).toBe('ast');
    expect(rule!.pattern.type).toBe('no-type-assertions');
  });

  it('extracts "no non-null assertions" rule', () => {
    const { rules } = extract('# Rules\n\n- No non-null assertions');
    const rule = findRule(rules, 'type-no-non-null');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-non-null-assertions');
  });

  it('extracts "no @ts-ignore" rule', () => {
    const { rules } = extract('# Rules\n\n- No @ts-ignore directives');
    const rule = findRule(rules, 'type-no-ts-directives');
    expect(rule).toBeDefined();
    expect(rule!.verifier).toBe('regex');
    expect(rule!.pattern.type).toBe('no-ts-directives');
  });

  it('matches "no ts-nocheck"', () => {
    const { rules } = extract('# Rules\n\n- No ts-nocheck');
    expect(findRule(rules, 'type-no-ts-directives')).toBeDefined();
  });
});

describe('extended matchers: code style', () => {
  it('extracts "no nested ternary" rule', () => {
    const { rules } = extract('# Rules\n\n- No nested ternary expressions');
    const rule = findRule(rules, 'style-no-nested-ternary');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-nested-ternary');
  });

  it('extracts "no magic numbers" rule', () => {
    const { rules } = extract('# Rules\n\n- No magic numbers');
    const rule = findRule(rules, 'style-no-magic-numbers');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-magic-numbers');
  });

  it('extracts "no else after return" rule', () => {
    const { rules } = extract('# Rules\n\n- No else after return');
    const rule = findRule(rules, 'style-no-else-after-return');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-else-after-return');
  });

  it('matches "use early returns"', () => {
    const { rules } = extract('# Rules\n\n- Use early returns');
    expect(findRule(rules, 'style-no-else-after-return')).toBeDefined();
  });

  it('extracts max function length with value', () => {
    const { rules } = extract('# Rules\n\n- Maximum function length: 30');
    const rule = findRule(rules, 'style-max-function-length');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('max-function-length');
    expect(rule!.pattern.expected).toBe('30');
  });

  it('extracts max params with value', () => {
    const { rules } = extract('# Rules\n\n- Maximum parameters: 3');
    const rule = findRule(rules, 'style-max-params');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('max-params');
    expect(rule!.pattern.expected).toBe('3');
  });

  it('matches "no more than 4 parameters"', () => {
    const { rules } = extract('# Rules\n\n- No more than 4 parameters per function');
    const rule = findRule(rules, 'style-max-params');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('4');
  });

  it('extracts "use single quotes" rule', () => {
    const { rules } = extract('# Rules\n\n- Use single quotes');
    const rule = findRule(rules, 'style-quote-style');
    expect(rule).toBeDefined();
    expect(rule!.verifier).toBe('regex');
    expect(rule!.pattern.expected).toBe('single');
  });

  it('extracts "no console statements" rule', () => {
    const { rules } = extract('# Rules\n\n- No console statements');
    const rule = findRule(rules, 'forbidden-no-console-extended');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-console-extended');
  });
});

describe('extended matchers: imports and structure', () => {
  it('extracts "no namespace imports" rule', () => {
    const { rules } = extract('# Rules\n\n- No namespace imports');
    const rule = findRule(rules, 'import-no-namespace');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-namespace-imports');
  });

  it('matches "no import * as"', () => {
    const { rules } = extract('# Rules\n\n- No import * as');
    expect(findRule(rules, 'import-no-namespace')).toBeDefined();
  });

  it('extracts "no barrel files" rule', () => {
    const { rules } = extract('# Rules\n\n- No barrel files');
    const rule = findRule(rules, 'structure-no-barrel-files');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-barrel-files');
  });

  it('extracts "banned package" rule with name', () => {
    const { rules } = extract('# Rules\n\n- Banned package: lodash');
    const rule = findRule(rules, 'import-banned-package');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('banned-import');
    expect(rule!.pattern.expected).toBe('lodash');
  });
});

describe('extended matchers: testing patterns', () => {
  it('extracts "no .only()" rule', () => {
    const { rules } = extract('# Rules\n\n- No focused tests');
    const rule = findRule(rules, 'test-no-only');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-test-only');
  });

  it('extracts "no .skip()" rule', () => {
    const { rules } = extract('# Rules\n\n- No skipped tests');
    const rule = findRule(rules, 'test-no-skip');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-test-skip');
  });

  it('extracts "no setTimeout in tests" rule', () => {
    const { rules } = extract('# Rules\n\n- No setTimeout in tests');
    const rule = findRule(rules, 'test-no-settimeout');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('no-setTimeout-in-tests');
  });
});

describe('extended matchers: project structure', () => {
  it('extracts "README must exist" rule', () => {
    const { rules } = extract('# Rules\n\n- README must exist');
    const rule = findRule(rules, 'structure-readme-exists');
    expect(rule).toBeDefined();
    expect(rule!.verifier).toBe('filesystem');
    expect(rule!.pattern.type).toBe('readme-exists');
  });

  it('extracts "maintain a CHANGELOG" rule', () => {
    const { rules } = extract('# Rules\n\n- Maintain a CHANGELOG');
    const rule = findRule(rules, 'structure-changelog-exists');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('changelog-exists');
  });

  it('extracts "use prettier" rule', () => {
    const { rules } = extract('# Rules\n\n- Use prettier for formatting');
    const rule = findRule(rules, 'structure-formatter-config');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('formatter-config-exists');
  });

  it('extracts "pin dependencies" rule', () => {
    const { rules } = extract('# Rules\n\n- Pin dependencies to exact versions');
    const rule = findRule(rules, 'dependency-pinned-versions');
    expect(rule).toBeDefined();
    expect(rule!.verifier).toBe('filesystem');
    expect(rule!.pattern.type).toBe('pinned-dependencies');
  });

  it('matches "exact versions"', () => {
    const { rules } = extract('# Rules\n\n- Use exact versions for dependencies');
    expect(findRule(rules, 'dependency-pinned-versions')).toBeDefined();
  });
});

describe('extended matchers: confidence and extractionMethod', () => {
  it('sets confidence to high by default', () => {
    const { rules } = extract('# Rules\n\n- No empty catch blocks');
    const rule = findRule(rules, 'error-no-empty-catch');
    expect(rule).toBeDefined();
    expect(rule!.confidence).toBe('high');
  });

  it('sets extractionMethod to static', () => {
    const { rules } = extract('# Rules\n\n- No enums');
    const rule = findRule(rules, 'type-no-enum');
    expect(rule).toBeDefined();
    expect(rule!.extractionMethod).toBe('static');
  });
});
