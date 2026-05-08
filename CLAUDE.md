# CLAUDE.md

Instructions for Claude (Claude Code, Claude SDK, claude.ai) when working on the RuleProbe codebase.

The full engineering rules live in [AGENTS.md](./AGENTS.md). Read that file first. Everything below is Claude-specific workflow guidance that supplements it. When the two conflict, AGENTS.md wins.

## Project

- Repository: https://github.com/moonrunnerkc/ruleprobe
- Package: https://www.npmjs.com/package/ruleprobe
- Language: TypeScript (strict)
- Runtime: Node.js >= 18

## Working Style

- Make targeted edits over full rewrites when a specific issue is flagged.
- Never pad documentation, README, or release notes with marginal results. Only genuinely interesting findings belong.
- Run verification before treating any feature as done: `npm test` and `npm run build`.
- Push back when a claim is not backed by real data. Do not invent metrics, repo counts, or compliance scores.
- Use `git status` and `git diff` to confirm what you actually changed before reporting completion.

## Engineering Standards

These are enforced by the self-check workflow (RuleProbe verifies its own codebase). Following them keeps the build green.

- Always use TypeScript strict mode.
- Never use `any`. Use `unknown` and narrow.
- Always use named exports. Never use default exports.
- Use kebab-case for filenames.
- Use camelCase for variables and functions.
- Use PascalCase for types, interfaces, and classes.
- Prefer `const` over `let`.
- Prefer `interface` over `type` for object shapes.
- Files must stay under 300 lines.
- Add full JSDoc to every exported symbol.
- Never use em dashes anywhere.
- No magic numbers without a named constant.

## Tooling

- Use `npm` as the package manager.
- Use `vitest` as the test runner.
- Use `eslint` for linting and `prettier` for formatting.
- Do not introduce competing tools (no biome, no jest, no pnpm).

## Pipeline Boundaries

When editing pipeline code, respect the three-stage boundary: parse, verify, report. Each stage is independently testable and lives under its own directory in `src/`.

- Parser code lives under `src/parser/`. The parser must not call verifier code.
- Verifier engines live under `src/verifiers/`. Each engine returns `VerificationResult[]`.
- Report generation lives under `src/report/`. Reports must not run verifications.
- The semantic tier under `src/semantic/` must never send source code, file paths, variable names, or comments to any LLM.

## Tree-sitter and Type-aware Checks

- Tree-sitter WASM grammars must fail gracefully. If a grammar fails to load, log a warning and continue. Never block other verifiers.
- Type-aware AST checks require `--project` and a valid `tsconfig.json`. Skip cleanly when absent.
- Semantic tier failures must never prevent deterministic results from returning.

## Testing

- Every new function requires at least one test.
- Test files live under `tests/` and mirror the `src/` structure.
- Tests must validate real behavior, not wiring.
- No mocks except at external API boundaries.
- Use `describe` and `it` blocks.
- Never use `console.log` in tests.
- New matchers require a test file with real-world instruction examples.

## Security

- Never execute scanned code.
- Never modify files in the scanned directory.
- Bound all paths to the working directory.
- Skip symlinks resolving outside the project root unless `--allow-symlinks` is passed.
- Never write API keys to disk.

## Claude Code Workflow

- When invoked through Claude Code, prefer running tests and builds in the integrated terminal so output is captured in the session.
- For multi-file changes, list the files you intend to touch before editing.
- For changes that affect the parser, run `ruleprobe parse` against `tests/fixtures/` instruction files to confirm no regression in extraction.
- For changes that affect a verifier, run `npm test -- <verifier-name>` before running the full suite.
- For changes that touch the semantic tier, manually verify that no source code, file paths, variable names, or comments appear in any outbound payload.

## Commit Messages

Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

Examples:
- `feat: add tree-sitter naming check for Rust`
- `fix: parser drops rules with backtick-wrapped patterns`
- `docs: update matchers.md with new file-structure entries`

## What Not To Do

- Do not refactor code outside the scope of the requested change.
- Do not weaken the security boundary to simplify an implementation.
- Do not push deterministic logic into the semantic tier.
- Do not add dependencies without justification.
- Do not write release notes that make claims unsupported by the actual diff.
- Do not present completion as fact without running tests and build.
