// Tests for the rule extractor: pattern recognition across all verifier types,
// instruction file parsing (CLAUDE.md, AGENTS.md, .cursorrules), and rule counter resets.

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import { parseMarkdown } from '../../src/parsers/markdown-parser.js';
import { parseInstructionFile, parseInstructionContent, detectFileType } from '../../src/parsers/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Rule, RuleCategory } from '../../src/types.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');

beforeEach(() => {
  resetRuleCounter();
});

/** Helper: parse markdown string and extract rules. */
function extract(md: string) {
  const sections = parseMarkdown(md);
  return extractRules(sections);
}

/** Helper: find a rule by its ID prefix. */
function findRule(rules: Rule[], idPrefix: string): Rule | undefined {
  return rules.find((r) => r.id.startsWith(idPrefix));
}

describe('extractRules: camelCase naming', () => {
  it('extracts from "Use camelCase for variables"', () => {
    const { rules } = extract('# Rules\n\n- Use camelCase for variables');
    const rule = findRule(rules, 'naming-camelcase');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('naming');
    expect(rule!.verifier).toBe('ast');
    expect(rule!.pattern.type).toBe('camelCase');
  });

  it('extracts from "Variables should be camelCase"', () => {
    const { rules } = extract('# Rules\n\n- Variables should be camelCase');
    const rule = findRule(rules, 'naming-camelcase');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('naming');
  });

  it('extracts from "Variable and function names: camelCase"', () => {
    const { rules } = extract('# Rules\n\n- Variable and function names: camelCase');
    const rule = findRule(rules, 'naming-camelcase');
    expect(rule).toBeDefined();
  });

  it('extracts from "camelCase variables only"', () => {
    const { rules } = extract('# Rules\n\n- Use camelCase for all variables and functions');
    const rule = findRule(rules, 'naming-camelcase');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: PascalCase naming', () => {
  it('extracts from "Type and interface names: PascalCase"', () => {
    const { rules } = extract('# Rules\n\n- Type and interface names: PascalCase');
    const rule = findRule(rules, 'naming-pascalcase');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('naming');
    expect(rule!.pattern.type).toBe('PascalCase');
    expect(rule!.pattern.target).toBe('types');
  });

  it('extracts from "PascalCase for types and interfaces"', () => {
    const { rules } = extract('# Rules\n\n- Use PascalCase for types and interfaces');
    const rule = findRule(rules, 'naming-pascalcase');
    expect(rule).toBeDefined();
  });

  it('extracts from "Classes must use PascalCase"', () => {
    const { rules } = extract('# Rules\n\n- Class names: PascalCase');
    const rule = findRule(rules, 'naming-pascalcase');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: kebab-case files', () => {
  it('extracts from "File names: kebab-case"', () => {
    const { rules } = extract('# Rules\n\n- File names: kebab-case');
    const rule = findRule(rules, 'naming-kebab-case-files');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('naming');
    expect(rule!.verifier).toBe('filesystem');
    expect(rule!.pattern.type).toBe('kebab-case');
  });

  it('extracts from "File names must be kebab-case"', () => {
    const { rules } = extract('# Rules\n\n- File names must be kebab-case');
    const rule = findRule(rules, 'naming-kebab-case-files');
    expect(rule).toBeDefined();
  });

  it('extracts from "Use kebab-case for file naming"', () => {
    const { rules } = extract('# Rules\n\n- Use kebab-case for file naming');
    const rule = findRule(rules, 'naming-kebab-case-files');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: no any type', () => {
  it('extracts from "no any types"', () => {
    const { rules } = extract('# Rules\n\n- TypeScript strict mode, no any types');
    const rule = findRule(rules, 'forbidden-no-any-type');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('forbidden-pattern');
    expect(rule!.verifier).toBe('ast');
    expect(rule!.pattern.type).toBe('no-any');
  });

  it('extracts from "Never use any type annotations"', () => {
    const { rules } = extract('# Rules\n\n- Never use any type annotations');
    const rule = findRule(rules, 'forbidden-no-any-type');
    expect(rule).toBeDefined();
  });

  it('extracts from "Avoid any type"', () => {
    const { rules } = extract('# Rules\n\n- Avoid any type usage');
    const rule = findRule(rules, 'forbidden-no-any-type');
    expect(rule).toBeDefined();
  });

  it('does not false-positive on "don\'t use any of these"', () => {
    const { rules } = extract('# Rules\n\n- Don\'t use any of these libraries');
    const rule = findRule(rules, 'forbidden-no-any-type');
    expect(rule).toBeUndefined();
  });
});

describe('extractRules: no console.log', () => {
  it('extracts from "No console.log in production code"', () => {
    const { rules } = extract('# Rules\n\n- No console.log in production code');
    const rule = findRule(rules, 'forbidden-no-console-log');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('forbidden-pattern');
    expect(rule!.pattern.type).toBe('no-console-log');
  });

  it('extracts from "Don\'t use console.log"', () => {
    const { rules } = extract('# Rules\n\n- Don\'t use console.log, use the logger');
    const rule = findRule(rules, 'forbidden-no-console-log');
    expect(rule).toBeDefined();
  });

  it('extracts from "Avoid console.log"', () => {
    const { rules } = extract('# Rules\n\n- Avoid console.log calls');
    const rule = findRule(rules, 'forbidden-no-console-log');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: named exports', () => {
  it('extracts from "Named exports only, no default exports"', () => {
    const { rules } = extract('# Rules\n\n- Named exports only, no default exports');
    const rule = findRule(rules, 'structure-named-exports-only');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('structure');
    expect(rule!.pattern.type).toBe('named-exports-only');
  });

  it('extracts from "No default exports"', () => {
    const { rules } = extract('# Rules\n\n- No default exports');
    const rule = findRule(rules, 'structure-named-exports-only');
    expect(rule).toBeDefined();
  });

  it('extracts from "Use named exports"', () => {
    const { rules } = extract('# Rules\n\n- Use named exports instead of default');
    const rule = findRule(rules, 'structure-named-exports-only');
    expect(rule).toBeDefined();
  });

  it('extracts from "Avoid default exports"', () => {
    const { rules } = extract('# Rules\n\n- Avoid default exports');
    const rule = findRule(rules, 'structure-named-exports-only');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: max file length', () => {
  it('extracts 300-line limit from "Maximum file length: 300 lines"', () => {
    const { rules } = extract('# Rules\n\n- Maximum file length: 300 lines');
    const rule = findRule(rules, 'structure-max-file-length');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('300');
  });

  it('extracts custom line limit', () => {
    const { rules } = extract('# Rules\n\n- Files must not exceed 250 lines');
    const rule = findRule(rules, 'structure-max-file-length');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('250');
  });
});

describe('extractRules: max line length', () => {
  it('extracts from "Maximum line length: 120"', () => {
    const { rules } = extract('# Rules\n\n- Maximum line length: 120');
    const rule = findRule(rules, 'structure-max-line-length');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('forbidden-pattern');
    expect(rule!.verifier).toBe('regex');
    expect(rule!.pattern.expected).toBe('120');
  });

  it('extracts from "Lines should not exceed 100 characters"', () => {
    const { rules } = extract('# Rules\n\n- Lines should not exceed 100 characters');
    const rule = findRule(rules, 'structure-max-line-length');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('100');
  });

  it('extracts from "Line length: 100" without max/maximum keyword', () => {
    const { rules } = extract('# Style\n\n- **Line length:** 100 characters');
    const rule = findRule(rules, 'structure-max-line-length');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('100');
  });
});

describe('extractRules: test file requirements', () => {
  it('extracts from "All files must have tests"', () => {
    const { rules } = extract('# Rules\n\n- All files must have tests');
    const rule = findRule(rules, 'test-files-exist');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('test-requirement');
    expect(rule!.verifier).toBe('filesystem');
  });

  it('extracts from "Every source file must have a corresponding test"', () => {
    const { rules } = extract('# Rules\n\n- Every source file must have a corresponding test');
    const rule = findRule(rules, 'test-files-exist');
    expect(rule).toBeDefined();
  });

  it('extracts test naming pattern from "named *.test.ts"', () => {
    const { rules } = extract('# Rules\n\n- Test files must be named *.test.ts');
    const rule = findRule(rules, 'test-named-pattern');
    expect(rule).toBeDefined();
    expect(rule!.pattern.expected).toBe('*.test.ts');
  });
});

describe('extractRules: import patterns', () => {
  it('extracts from "No relative imports deeper than 2 levels"', () => {
    const { rules } = extract('# Rules\n\n- No relative imports deeper than 2 levels');
    const rule = findRule(rules, 'import-no-deep-relative');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('import-pattern');
    expect(rule!.pattern.expected).toBe('2');
  });

  it('extracts from "Avoid deep relative imports"', () => {
    const { rules } = extract('# Rules\n\n- Avoid deep relative imports');
    const rule = findRule(rules, 'import-no-deep-relative');
    expect(rule).toBeDefined();
  });

  it('extracts from "Imports use relative paths, no path aliases"', () => {
    const { rules } = extract('# Rules\n\n- Imports use relative paths within the project (no path aliases)');
    const rule = findRule(rules, 'import-no-path-aliases');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('import-pattern');
  });
});

describe('extractRules: JSDoc requirement', () => {
  it('extracts from "Every public function has a JSDoc comment"', () => {
    const { rules } = extract('# Rules\n\n- Every public function has a JSDoc comment describing its contract');
    const rule = findRule(rules, 'structure-jsdoc-required');
    expect(rule).toBeDefined();
    expect(rule!.pattern.type).toBe('jsdoc-required');
  });

  it('extracts from "JSDoc required on all public functions"', () => {
    const { rules } = extract('# Rules\n\n- JSDoc is required for all exports');
    const rule = findRule(rules, 'structure-jsdoc-required');
    expect(rule).toBeDefined();
  });
});

describe('extractRules: strict mode', () => {
  it('extracts from "TypeScript strict mode"', () => {
    const { rules } = extract('# Rules\n\n- TypeScript strict mode, no any types');
    const rule = findRule(rules, 'structure-strict-mode');
    expect(rule).toBeDefined();
    expect(rule!.category).toBe('structure');
    expect(rule!.verifier).toBe('filesystem');
  });
});

describe('extractRules: unparseable lines', () => {
  it('captures subjective statements as unparseable', () => {
    const { unparseable } = extract(`# Rules

- Write clean code
- Follow best practices
- Use clear variable names
- Keep it simple
`);

    expect(unparseable.length).toBeGreaterThan(0);
    // At least the subjective lines should be captured
    const unparseableJoined = unparseable.join('\n');
    expect(unparseableJoined).toMatch(/clean code|best practices/i);
  });

  it('does not put extractable rules into unparseable', () => {
    const { rules, unparseable } = extract(`# Rules

- Use camelCase for variables
- No any types
- Named exports only
`);

    expect(rules.length).toBeGreaterThan(0);
    // None of the extractable rules should end up in unparseable
    for (const line of unparseable) {
      expect(line).not.toMatch(/camelCase/);
      expect(line).not.toMatch(/any type/i);
      expect(line).not.toMatch(/named export/i);
    }
  });

  it('skips structural markdown (code fences, tables, images)', () => {
    const { unparseable } = extract(`# Rules

\`\`\`typescript
const x = 1;
\`\`\`

| Col1 | Col2 |
|------|------|
| val1 | val2 |

![image](./picture.png)
`);

    // None of these structural elements should appear in unparseable
    for (const line of unparseable) {
      expect(line).not.toMatch(/^\|/);
      expect(line).not.toMatch(/^```/);
      expect(line).not.toMatch(/^!\[/);
    }
  });
});

describe('extractRules: deduplication', () => {
  it('deduplicates rules matched by the same matcher', () => {
    const { rules } = extract(`# Rules

- Use camelCase for variables
- Variable names: camelCase
- Variables should be camelCase
`);

    // All three lines match the same camelCase variables matcher,
    // so only one rule should be produced
    const camelCaseRules = rules.filter((r) => r.id.startsWith('naming-camelcase-variables'));
    expect(camelCaseRules).toHaveLength(1);
  });

  it('keeps rules from different matchers', () => {
    const { rules } = extract(`# Rules

- Use camelCase for variables
- PascalCase for types
- File names: kebab-case
`);

    expect(rules.length).toBe(3);
  });
});

describe('parseInstructionFile: sample-claude.md fixture', () => {
  it('produces a RuleSet with correctly categorized rules', () => {
    const filePath = resolve(fixturesDir, 'sample-claude.md');
    const ruleSet = parseInstructionFile(filePath);

    expect(ruleSet.sourceFile).toBe(filePath);
    // Not a recognized instruction file name, but .md with rules -> generic-markdown
    expect(ruleSet.sourceType).toBe('generic-markdown');
    expect(ruleSet.rules.length).toBeGreaterThan(0);

    // Verify specific rules were extracted
    const categories = new Set(ruleSet.rules.map((r) => r.category));
    expect(categories.has('naming')).toBe(true);
    expect(categories.has('forbidden-pattern')).toBe(true);
    expect(categories.has('structure')).toBe(true);

    // Check for specific rules we know are in the fixture
    expect(findRule(ruleSet.rules, 'naming-camelcase')).toBeDefined();
    expect(findRule(ruleSet.rules, 'naming-pascalcase')).toBeDefined();
    expect(findRule(ruleSet.rules, 'naming-kebab-case')).toBeDefined();
    expect(findRule(ruleSet.rules, 'forbidden-no-any')).toBeDefined();
    expect(findRule(ruleSet.rules, 'forbidden-no-console')).toBeDefined();
    expect(findRule(ruleSet.rules, 'structure-named-exports')).toBeDefined();
    expect(findRule(ruleSet.rules, 'structure-jsdoc')).toBeDefined();

    // Verify unparseable has the subjective lines
    expect(ruleSet.unparseable.length).toBeGreaterThan(0);
  });
});

describe('parseInstructionFile: sample-agents.md fixture', () => {
  it('produces a RuleSet with correctly categorized rules', () => {
    const filePath = resolve(fixturesDir, 'sample-agents.md');
    const ruleSet = parseInstructionFile(filePath);

    expect(ruleSet.sourceFile).toBe(filePath);
    expect(ruleSet.rules.length).toBeGreaterThan(0);

    // Check specific rules from the agents fixture
    expect(findRule(ruleSet.rules, 'naming-camelcase')).toBeDefined();
    expect(findRule(ruleSet.rules, 'naming-pascalcase')).toBeDefined();
    expect(findRule(ruleSet.rules, 'naming-kebab-case')).toBeDefined();
    expect(findRule(ruleSet.rules, 'forbidden-no-any')).toBeDefined();
    expect(findRule(ruleSet.rules, 'forbidden-no-console')).toBeDefined();
    expect(findRule(ruleSet.rules, 'structure-named-exports')).toBeDefined();
    expect(findRule(ruleSet.rules, 'test-files-exist')).toBeDefined();
    expect(findRule(ruleSet.rules, 'structure-jsdoc')).toBeDefined();

    // The agents fixture has a 250-line file limit
    const fileLengthRule = findRule(ruleSet.rules, 'structure-max-file-length');
    expect(fileLengthRule).toBeDefined();
    expect(fileLengthRule!.pattern.expected).toBe('250');

    // And a 100-character line limit
    const lineLengthRule = findRule(ruleSet.rules, 'structure-max-line-length');
    expect(lineLengthRule).toBeDefined();
    expect(lineLengthRule!.pattern.expected).toBe('100');

    // Verify unparseable captured the subjective stuff
    expect(ruleSet.unparseable.length).toBeGreaterThan(0);
  });
});

describe('detectFileType', () => {
  it('detects CLAUDE.md', () => {
    expect(detectFileType('/project/CLAUDE.md')).toBe('claude.md');
  });

  it('detects AGENTS.md', () => {
    expect(detectFileType('/project/AGENTS.md')).toBe('agents.md');
  });

  it('detects .cursorrules', () => {
    expect(detectFileType('/project/.cursorrules')).toBe('cursorrules');
  });

  it('detects copilot-instructions.md', () => {
    expect(detectFileType('/project/.github/copilot-instructions.md')).toBe('copilot-instructions');
  });

  it('detects GEMINI.md', () => {
    expect(detectFileType('/project/GEMINI.md')).toBe('gemini.md');
  });

  it('detects .windsurfrules', () => {
    expect(detectFileType('/project/.windsurfrules')).toBe('windsurfrules');
  });

  it('returns unknown for unrecognized files', () => {
    expect(detectFileType('/project/README.md')).toBe('unknown');
    expect(detectFileType('/project/random.txt')).toBe('unknown');
  });
});

describe('parseInstructionContent', () => {
  it('works with inline content instead of file reading', () => {
    const content = `# Rules

- Use camelCase for variable names
- No any types allowed
`;

    const ruleSet = parseInstructionContent(content, 'CLAUDE.md');

    expect(ruleSet.sourceFile).toBe('CLAUDE.md');
    expect(ruleSet.sourceType).toBe('claude.md');
    expect(ruleSet.rules.length).toBeGreaterThan(0);
    expect(findRule(ruleSet.rules, 'naming-camelcase')).toBeDefined();
    expect(findRule(ruleSet.rules, 'forbidden-no-any')).toBeDefined();
  });
});
