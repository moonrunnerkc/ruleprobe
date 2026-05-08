# Changelog

All notable changes to this project will be documented in this file.

## [4.5.0] - 2026-05-08

### Breaking Changes

- **Default action mode changed.** The primary workflow is now `lint-config`, `drift`, and `extract`, not `verify`. The GitHub Action defaults to drift detection mode.
- **`compare` command removed.** Agent comparison is no longer a primary use case. Use drift detection instead.
- **`tasks` and `task` commands removed.** Task template listing and printing removed.
- **`run` command removed.** Agent invocation via the Claude Agent SDK removed. The `@anthropic-ai/claude-agent-sdk` is no longer a dependency.
- **Runner module removed from public API.** `buildAgentConfig`, `invokeAgent`, `isAgentSdkAvailable`, `hasAgentOutput`, `watchForCompletion`, `countCodeFiles`, `AgentInvocationConfig`, `RunOptions`, `InvocationResult`, `WatchOptions`, `WatchResult` are no longer exported.
- **`formatComparisonMarkdown` removed.** The comparison report formatter is no longer exported from `reporter/index`.
- **`verify` command deprecated.** Still works, but the primary workflow is now translate, detect drift, and extract.
- **67 unmappable matchers removed.** Categories removed: `test-requirement`, `dependency`, `preference`, `file-structure`, `tooling`, `testing`, `workflow`. Verifier types removed: `treesitter`, `preference`, `tooling`, `config-file`, `git-history`. The remaining 34 matchers all map to ESLint rules.
- **`RuleCategory` union narrowed.** Removed: `test-requirement`, `dependency`, `preference`, `file-structure`, `tooling`, `testing`, `workflow`. Remaining: `naming`, `forbidden-pattern`, `structure`, `import-pattern`, `error-handling`, `type-safety`, `code-style`, `agent-behavior`.
- **`VerifierType` union narrowed.** Removed: `treesitter`, `preference`, `tooling`, `config-file`, `git-history`. Remaining: `ast`, `regex`, `filesystem`.

### New Features

- **`lint-config` command.** Translates an instruction file into a flat or legacy ESLint config. Unmappable rules appear as comments in the output.
- **`drift` command.** Compares an instruction file against an existing ESLint config. Reports rules present in one but missing from the other, severity mismatches, and config argument differences.
- **`extract` command.** Parses an ESLint config and emits a markdown rules section suitable for pasting into an instruction file.

### Removed

- `compare` command and `formatComparisonMarkdown` export.
- `tasks` and `task` commands and `src/runner/task-templates/` directory.
- `run` command and `src/runner/agent-configs.ts`, `src/runner/agent-invoker.ts`, `src/runner/watch-mode.ts`.
- Matcher files: `rule-patterns-preference.ts`, `rule-patterns-file-structure.ts`, `rule-patterns-tooling.ts`, `rule-patterns-testing.ts`, `rule-patterns-config-file.ts`, `rule-patterns-git-history.ts`.
- Individual unmappable matchers from remaining files: `test-files-exist`, `test-named-pattern`, `structure-strict-mode`, `error-async-try-catch`, `structure-typescript-required`, `error-log-contextual`, `import-no-unresolved`, `naming-python-snake-case`, `naming-python-class`, `naming-go-conventions`, `style-python-function-length`, `style-go-function-length`, `style-concise-conditionals`, `naming-kebab-case-directories`, `structure-no-barrel-files`, `test-no-settimeout`, `test-no-only`, `test-no-skip`, `import-banned-package`, `structure-readme-exists`, `structure-changelog-exists`, `structure-formatter-config`, `dependency-pinned-versions`.

### Stats

| Metric | v4.0.0 | v4.5.0 |
|--------|--------|--------|
| Rule matchers | ~103 | 34 |
| Rule categories | 14 | 7 (+ `agent-behavior`) |
| Verifier engines | 8 | 3 |
| CLI commands | 9 | 6 |
| Public API exports | ~40 | ~25 |

## [4.0.0] - 2026-04-28

Major release consolidating the three-repo architecture. See [docs/release-v4.0.0.md](docs/release-v4.0.0.md) for full details.

## [1.0.0] - 2026-04-07

14 commits, 100 files changed, +9,017 lines since v0.1.0.

### Breaking Changes

- `verifyOutput` is now async. Returns `Promise<RuleResult[]>` instead of `RuleResult[]`. Callers must `await` it.
- `RuleCategory` union expanded from 5 to 9 members: added `error-handling`, `type-safety`, `code-style`, `dependency`. Exhaustive `switch` statements and `Record<RuleCategory, ...>` types need updating.
- `VerifierType` union expanded: added `treesitter`.

### New Features

**53 matchers across 9 categories** (was 15 matchers, 5 categories). 19 new AST checks, 7 new regex checks, 5 new filesystem checks, 4 new tree-sitter checks covering error handling, type safety, code style, and dependency verification.

**User-defined rules via `ruleprobe.config.ts`.** Add custom rules, override extracted rule severity or thresholds, exclude rules entirely. Auto-discovered in the working directory or specified with `--config`. `defineConfig()` export provides TypeScript type checking. Supports `.ts`, `.js`, `.json`, and `.ruleproberc.json` formats.

**LLM-assisted extraction (`--llm-extract`).** Sends unparseable instruction lines through an OpenAI-compatible API for a second extraction pass. Extracted rules tagged with `extractionMethod: 'llm'`, `confidence: 'medium'`, severity `warning`. Requires `OPENAI_API_KEY`. Opt-in only; default behavior unchanged.

**Rubric decomposition (`--rubric-decompose`).** Breaks subjective instructions ("write clean code") into weighted concrete checks (max function length, no magic numbers, etc.) via LLM. Tagged with `extractionMethod: 'rubric'`, `confidence: 'low'`. Requires `OPENAI_API_KEY`. Opt-in only.

**Agent invocation (`ruleprobe run`).** Invoke Claude via the Agent SDK, capture output, verify, and report in one step. Also supports `--watch` mode for any agent that writes to a directory. Requires `@anthropic-ai/claude-agent-sdk` and `ANTHROPIC_API_KEY` for SDK mode. Watch mode needs no dependencies.

**Tree-sitter multi-language support.** Python and Go get naming and function-length checks via WASM grammars. Grammar packages (`web-tree-sitter`, `tree-sitter-python`, `tree-sitter-go`) ship as regular dependencies. If loading fails on a platform, tree-sitter checks are skipped and other verifiers still run.

**Type-aware checks (`--project`).** Pass a `tsconfig.json` to enable cross-file type analysis: implicit `any` detection through aliases, unused exports, unresolved imports. Falls back to isolated-file parsing automatically if compilation fails.

### New CLI Flags

- `--llm-extract` on `parse` and `verify`
- `--rubric-decompose` on `verify`
- `--config` on `verify`, `compare`, and `run`
- `--project` on `verify` and `run`

### New Public API Exports

Functions: `defineConfig`, `loadConfig`, `applyConfig`, `extractWithLlm`, `createOpenAiProvider`, `buildAgentConfig`, `invokeAgent`, `isAgentSdkAvailable`, `hasAgentOutput`, `watchForCompletion`, `countCodeFiles`

Types: `VerifyOptions`, `RuleProbeConfig`, `CustomRule`, `RuleOverride`, `LlmProvider`, `LlmRuleCandidate`, `LlmExtractionResult`, `LlmExtractOptions`, `OpenAiProviderConfig`, `AgentInvocationConfig`, `RunOptions`, `InvocationResult`, `WatchOptions`, `WatchResult`

### Resolved Limitations

Every limitation documented in v0.1.0 has been addressed:

- "TypeScript and JavaScript only": Python and Go via tree-sitter.
- "No subjective evaluation": `--rubric-decompose` decomposes subjective rules into measurable proxies.
- "No automated agent invocation": `ruleprobe run` with Claude SDK and watch mode.
- "Conservative extraction (15 matchers)": 53 matchers, plus `--llm-extract` for the remainder.
- "Type-level checks are limited": `--project` enables TypeChecker-dependent analysis.

### Stats

| Metric | v0.1.0 | v1.0.0 |
|--------|--------|--------|
| Source files | 30 | 75 |
| Source lines | 3,328 | 8,607 |
| Test files | 13 | 27 |
| Rule matchers | 15 | 53 |
| Rule categories | 5 | 9 |
| Verifier engines | 3 | 4 |
| CLI commands | 5 | 6 |
| Public API exports | 15 | 40 |

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
