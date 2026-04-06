# RuleProbe: Agent Instruction Adherence Comparison

Rules source: /home/brad/projects/ruleprobe/tests/fixtures/case-study-rules.md (10 rules extracted, 0 unparseable)
Task: manual
Date: 2026-04-06

| Rule | agent-a | agent-b |
| ------ | :------: | :------: |
| Variables and functions must use camelCase naming | PASS | FAIL |
| Types, interfaces, and classes must use PascalCase naming | PASS | PASS |
| File names must use kebab-case | PASS | PASS |
| The "any" type must not be used | FAIL | PASS |
| console.log must not be used in production code | FAIL | PASS |
| Only named exports are allowed, no default exports | PASS | FAIL |
| Every public function must have a JSDoc comment | PASS | PASS |
| Files must not exceed the maximum line count | PASS | FAIL |
| Every source file must have a corresponding test file | FAIL | PASS |
| Imports must use relative paths, not path aliases | PASS | PASS |

| Agent | Score |
|-------|-------|
| agent-a (unknown) | 70% |
| agent-b (unknown) | 70% |
