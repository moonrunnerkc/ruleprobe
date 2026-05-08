# AGENTS.md

Instructions for AI coding agents working on the RuleProbe codebase.

RuleProbe verifies whether agents follow instruction files. This file is the instruction file for agents working on RuleProbe itself. It is parsed by RuleProbe in the self-check workflow, so every rule below is written to be machine-verifiable.

## Project

- Repository: https://github.com/moonrunnerkc/ruleprobe
- Package: https://www.npmjs.com/package/ruleprobe
- Language: TypeScript (strict)
- Runtime: Node.js >= 18
- License: MIT

## Build and Test

- Use `npm` as the package manager. Do not switch to pnpm, yarn, or bun.
- Use `vitest` as the test runner. Do not introduce jest or mocha.
- Run `npm test` before declaring any change complete.
- Run `npm run build` to verify the TypeScript compile is clean.
- A `package-lock.json` must exist at the repo root.
- Pinned dependency versions are required in `package.json` (no `^` or `~` ranges).

## Code Style

- Use TypeScript strict mode. Never disable strict checks.
- Never use `any`. Use `unknown` and narrow, or define a precise type.
- Always use named exports. Never use default exports.
- Use camelCase for variables and functions.
- Use PascalCase for types, interfaces, and classes.
- Use kebab-case for filenames.
- Prefer `const` over `let`.
- Prefer `interface` over `type` for object shapes.
- Prefer `async/await` over `.then()` chains.
- Never use `console.log` in production code. Use the structured logger.
- Never use `eval`.
- No magic numbers without a named constant or inline comment justifying the value.
- No em dashes anywhere in source, comments, docs, or commit messages. Use commas, colons, semicolons, parentheses, or separate sentences.
- Files must stay under 300 lines. If a file approaches the limit, decompose it.
- Add full JSDoc to every exported function, class, and type.
- Avoid nested ternaries. Use early returns to flatten control flow.

## Architecture Boundaries

- Parser code lives under `src/parser/`. Do not call verifier code from the parser.
- Verifier engines live under `src/verifiers/`. Each engine exports a single entrypoint that returns `VerificationResult[]`.
- The semantic tier lives under `src/semantic/`. Source code must never leave the user's machine. Only numeric AST vectors, opaque sub-tree hashes, boolean flags, and rule text may be sent to an LLM.
- The CLI lives under `src/cli/`. Commands compose pipeline functions; they do not contain pipeline logic.
- Shared types live under `src/types/`. Do not duplicate type definitions across modules.

## Verifier Engines

There are eight verifier engines: `ast`, `filesystem`, `regex`, `treesitter`, `preference`, `tooling`, `config-file`, `git-history`. When adding a check, use an existing engine. Adding a new engine requires a written justification in the PR description.

- AST checks must use `ts-morph`. Do not parse TypeScript with regex.
- Tree-sitter WASM loading must fail gracefully. If a grammar fails to load, log a warning and skip the check. Never block other verifiers.
- Type-aware AST checks (implicit any, unused exports, unresolved imports) require a `tsconfig.json` and the `--project` flag. Skip cleanly when absent.
- Semantic tier failures must never prevent deterministic results from returning.

## Parser Rules

- The parser supports 7 instruction file formats: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`, `.rules`. Parser changes must not break extraction for any of them.
- Lines that cannot be mapped to a deterministic check go into the `unparseable` array. Do not invent rules to inflate the parse rate.
- LLM-extracted rules must be tagged `extractionMethod: 'llm'` with `confidence: 'medium'`.
- Rubric-decomposed rules must be tagged `confidence: 'low'`.

## Testing

- Every new function requires at least one test.
- Test files live under `tests/` and mirror the `src/` directory structure.
- Test names describe behavior, not implementation.
- Tests must validate real behavior, not wiring. Reading the implementation should not be required to understand what a test verifies.
- No mocks except at external API boundaries (Anthropic API, OpenAI API, GitHub API, filesystem boundaries when testing error paths).
- Use `describe` and `it` blocks. Do not use `test()` directly.
- Never use `console.log` in tests.
- New matchers require: the matcher implementation, a test file with real-world instruction examples, and an entry in `docs/matchers.md`.

## Security

- Never execute scanned code.
- Never modify files in the scanned directory.
- All user-supplied paths must be resolved and bounded to the working directory.
- Symlinks resolving outside the project root must be skipped unless `--allow-symlinks` is passed.
- Never write API keys to disk or include them in reports.
- Network calls are allowed only when the user opts in: `--llm-extract`, `--rubric-decompose`, `--semantic`, or `ruleprobe run`.

## Imports

- No path aliases. Use relative imports.
- No barrel imports from deep internal modules. Import directly from the file that defines the symbol.
- No wildcard imports.
- Do not import lodash. Use native JavaScript methods.

## Error Handling

- Never use empty catch blocks.
- Never swallow errors silently. Log or rethrow.
- Catch clauses must declare the caught type as `unknown` and narrow.
- Error messages must include what failed and what to do about it.

## Git Workflow

- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Branch names use kebab-case: `feat/new-matcher`, `fix/parser-bug`.
- Pull requests must pass the self-check workflow before merge.
- Do not commit `.env` files or any file containing secrets.

## Configuration Files

- ESLint config lives at `.eslintrc.json` or `eslint.config.js`.
- Prettier config lives at `.prettierrc` or `.prettierrc.json`.
- TypeScript config lives at `tsconfig.json`.
- Vitest config lives at `vitest.config.ts`.
- Do not add competing tools (Biome alongside ESLint, Rome, etc.).

## Documentation

- Update `docs/matchers.md` when adding or modifying a matcher.
- Update `docs/cli-reference.md` when adding or changing a CLI command or flag.
- Update `docs/api-reference.md` when changing the public API surface.
- Update the relevant release notes file under `docs/` for any user-facing change.

## What Not To Do

- Do not introduce a new agent SDK adapter without a corresponding integration test.
- Do not weaken the security boundary to make a check easier to implement.
- Do not push deterministic logic into the semantic tier because it is easier to write.
- Do not add features that require API keys for the default deterministic path.
- Do not add dependencies without a clear justification. Each dependency is a maintenance cost.
