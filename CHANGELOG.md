# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- 23 new rule matchers, bringing total from 15 to 38 across 9 categories
- 4 new categories: error-handling, type-safety, code-style, dependency
- AST checks: empty catch blocks, enum usage, type assertions, non-null assertions, throw non-Error, console.warn/error, nested ternaries, magic numbers, else-after-return, max function length, max params, namespace imports, barrel files, setTimeout in tests
- Regex checks: @ts-ignore/@ts-nocheck directives, .only in tests, .skip in tests, quote style, banned imports
- Filesystem checks: README/CHANGELOG existence, formatter config, pinned dependency versions
- Rule confidence scoring (high/medium/low) and extraction method tracking (static/llm/custom)
- Extended test suite: 66 new tests covering all new matchers and checks
- Decomposed file-verifier into filesystem-checks and project-checks modules

### Changed

- isInstructionCandidate expanded to recognize 30+ additional instruction patterns
- matchLine now propagates confidence and extractionMethod fields

## [0.1.0] - 2026-04-06

Initial release.

### Added

- Instruction file parser supporting CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, GEMINI.md, and .windsurfrules
- Rule extractor with 15 matchers across 5 categories (naming, forbidden-pattern, structure, test-requirement, import-pattern)
- AST verifier using ts-morph for code structure checks (camelCase, PascalCase, no-any, no-console-log, named-exports, JSDoc, path aliases, deep relative imports)
- File system verifier for file naming conventions, test file existence, and directory structure
- Regex verifier for line length and file length limits
- CLI with 5 commands: parse, verify, tasks, task, compare
- Three report formats: text (terminal), JSON (CI), markdown (publishing)
- Reviewdog rdjson output format for inline PR annotations via `--format rdjson`
- GitHub Action (composite) for CI integration on every PR: verifies instruction adherence, posts PR comments, supports reviewdog
- Structured exit codes for CI: 0 (pass), 1 (violations), 2 (error)
- Programmatic API: parseInstructionFile, extractRules, verifyOutput, generateReport, formatReport
- Three task templates: rest-endpoint, utility-module, react-component
- Case study comparing two simulated agents on the rest-endpoint task
- Path traversal protection with `--allow-symlinks` flag
- All dependencies pinned to exact versions
