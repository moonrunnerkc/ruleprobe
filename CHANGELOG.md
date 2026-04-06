# Changelog

All notable changes to this project will be documented in this file.

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
- Programmatic API: parseInstructionFile, extractRules, verifyOutput, generateReport, formatReport
- Three task templates: rest-endpoint, utility-module, react-component
- Case study comparing two simulated agents on the rest-endpoint task
