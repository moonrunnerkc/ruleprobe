# RuleProbe Tech Debt Review - 2026-05-08

## Scope And Verification

This review covers the current workspace at `/home/brad/projects/ruleprobe`, with focus on implementation debt, product correctness, packaging, tests, and the README. Findings are based on local source inspection and commands run in this checkout.

Verification commands run:

- `npm test`, passed: 91 test files and 1290 tests
- `npm run build`, passed: TypeScript compile completed
- `npm --cache /tmp/ruleprobe-npm-cache pack --dry-run`, completed and exposed package contents
- `node dist/cli.js lint-config AGENTS.md --format flat --output /tmp/ruleprobe-flat-config.js`, generated output
- `node --input-type=module --check < /tmp/ruleprobe-flat-config.js`, failed with a syntax error
- `node dist/cli.js lint-config AGENTS.md --format legacy --output /tmp/ruleprobe-legacy-config.json`, generated output
- `JSON.parse` against the generated legacy config, failed because the file is not JSON
- `node dist/cli.js verify AGENTS.md src --format summary`, failed because `summary` is not an accepted verify format

## Executive Diagnosis

RuleProbe appears to be mid-transition from a broad deterministic verifier into an ESLint translation and drift product. The old parser and verifier paths still exist, the new mapper and emitter paths are not validated end to end, and the docs describe a mix of both product shapes. As a result, tests and TypeScript compilation pass, but the primary advertised workflow can produce invalid configuration files.

The highest-risk debt is contract drift between these layers:

- Parser output says some rules are deterministic when they are generic or subjective.
- Verifier engines treat unsupported checks as passes.
- ESLint config emission produces artifacts that do not parse or run.
- README and reference docs describe commands, formats, and guarantees that no longer match the CLI.
- Package output includes stale files because `dist` is not cleaned before publishing.

The root cause is an incomplete product migration without executable contract tests for CLI examples, emitted ESLint configs, GitHub Action behavior, and package contents.

## Priority Findings

### P0: Generated ESLint Configs Are Invalid

The `lint-config` command currently emits invalid files for the README's core use case.

Evidence:

- `src/emitter/eslint.ts` builds flat config rule entries as array expressions such as `['rule-name', error]` inside a `rules: {}` object.
- Severity values are emitted as bare identifiers, for example `error`, instead of string values.
- Legacy `.eslintrc` output includes comments and trailing comma style output, so it is not valid JSON despite the README recommending `.eslintrc.json`.
- Flat config imports plugin modules but does not register them in a `plugins` object for the generated config object.
- `node --input-type=module --check < /tmp/ruleprobe-flat-config.js` failed on generated output.
- `JSON.parse` failed on generated legacy config output.
- `tests/emitter/eslint.test.ts` checks substrings, not whether the output parses or works as an ESLint config.

Root cause:

The emitter is tested as text instead of as an executable artifact. Mapper entries also mix rule options and severity, which makes correct emission harder.

Suggested solution:

- Redesign the mapped rule shape to separate `ruleName`, `severity`, `options`, `plugins`, and `imports`.
- Emit flat config rules as object properties: `'rule/name': ['error', ...options]`.
- Emit legacy JSON with no comments and no JavaScript syntax when the target is `.json`.
- Add tests that generate configs, parse them, import flat configs, and run ESLint against small fixture files.
- Add README example tests so every documented CLI command is executed in CI.

### P0: Drift And Extract Do Not Support The Config Formats They Advertise

The drift path cannot reliably parse modern ESLint config files, including TypeScript config files.

Evidence:

- `src/drift/parseEslintConfig.ts` documents JavaScript config support.
- The synchronous parser calls a JavaScript parser branch that throws and tells callers to use the async parser.
- `src/commands/drift.ts` and `src/commands/extract.ts` call the synchronous parser.
- `.ts` ESLint config files are not treated as JavaScript-like configs, so they fall through toward JSON parsing.
- The GitHub Action and README prefer `eslint.config.ts`, `eslint.config.mjs`, or `eslint.config.js`.

Root cause:

Async config loading was added beside the old synchronous API, but command entrypoints were not migrated. The supported file extension list also lags the docs and action behavior.

Suggested solution:

- Make ESLint config parsing async-only at the command boundary.
- Support `eslint.config.js`, `.mjs`, `.cjs`, and `.ts` explicitly.
- Use ESLint's own config loading APIs where possible instead of homegrown parsing.
- Add CLI tests for flat config, legacy JSON, and TypeScript config inputs.
- Remove or make private the sync parser if it cannot support advertised formats.

### P0: Unsupported Parser Rules Can Become False Passes

The parser still converts broad or subjective instructions into generic rules, and the deterministic verifiers can report those rules as passing without evidence.

Evidence:

- Parsing `AGENTS.md` returned 18 rules and 7 unparseable lines.
- Several broad instructions became generic pattern types such as `tooling-command`, `imperative-direct`, `prefer-pattern`, `workflow`, and `naming-convention`.
- Running those generic rules through the verifier against `src` returned `passed: true`, `compliance: 1`, and zero evidence.
- `src/parsers/rule-assembler.ts` still creates generic rules when no concrete matcher is found.
- `src/parsers/rule-assembler-helpers.ts` maps generic categories into verifier engines.
- `src/verifier/regex-verifier.ts` and `src/verifier/file-verifier.ts` default to no evidence and then pass when no violations are found.
- README and matcher docs say subjective or unmapped lines should be unparseable, not converted into invented checks.

Root cause:

Classification confidence is being treated as deterministic verifiability. The verifier result model also lacks a clear unsupported or skipped state for unknown pattern types.

Suggested solution:

- Define a strict allowlist of deterministic pattern types per engine.
- Move unmatched or generic instructions to `unparseable` unless there is an exact deterministic implementation.
- Change verifier defaults so unknown pattern types return unsupported, skipped, or an explicit error, never pass.
- Add parser regression tests using this repository's `AGENTS.md`.
- Add a result invariant: a passed deterministic check must either have a concrete implementation path or evidence that the check was evaluated.

### P0: GitHub Action Drift Mode Is Likely Broken

The action's drift path appears unable to invoke RuleProbe reliably and may choose a nonexistent ESLint config file.

Evidence:

- `src/action/runner.ts` runs `ruleprobe` directly for drift commands.
- `action.yml` runs `npm ci` and `npm run build` inside the action path, but does not put a `ruleprobe` binary on `PATH`.
- The verify shell path uses `RULEPROBE_BIN`, but drift does not.
- `findEslintFileInWorkspace` calls an async `readFile` dependency without `await` inside a synchronous function. The promise itself will not throw in that `try` block, so the first candidate can be returned even when absent.
- `action.yml` overrides `GITHUB_OUTPUT`, which is normally provided by GitHub Actions.

Root cause:

The action is tested through injected command and filesystem functions, not as a real composite action workflow in a temp checkout.

Suggested solution:

- Use the same resolved local CLI path for verify and drift.
- Make config file detection async and await filesystem checks.
- Do not override `GITHUB_OUTPUT`; write to the environment-provided path.
- Add an integration test that runs the action script in a temp checkout with no global `ruleprobe`.
- Add tests for fallback config detection when the first candidate does not exist.

### P1: README And Reference Docs Are Stale

The docs describe commands, formats, and guarantees that do not match the current CLI and implementation.

Evidence:

- README quick start recommends generating `.eslintrc.json`, but current legacy output is not JSON.
- README advertises `verify --format summary`, but the CLI rejects `summary` and accepts only `text`, `json`, `markdown`, and `rdjson`.
- README says all dependencies are pinned, but `package.json` contains `^` ranges.
- README says other languages get regex and filesystem checks, but the verify command filters source files to TypeScript and JavaScript extensions.
- README claims remaining matchers produce valid ESLint rule entries, but generated configs are invalid.
- `docs/cli-reference.md` still documents removed commands such as `compare`, `tasks`, `task`, and `run`.
- `docs/api-reference.md` documents old agent invocation APIs and old verifier categories.
- `docs/matchers.md` claims 102 matchers and 14 categories, while README claims 34 matchers and 7 categories.

Root cause:

The v4.5 product pivot did not include a documentation migration plan or documentation tests. The docs are handwritten snapshots rather than generated or validated contract docs.

Suggested solution:

- Treat README examples as executable smoke tests.
- Generate command reference output from the CLI help text or test that docs and help agree.
- Split docs into current v4.5 behavior and archived historical behavior if old commands matter.
- Update the README only after emitter, drift, and action fixes land, or mark broken workflows as experimental.
- Add a release checklist item requiring docs, README, and CLI examples to be tested before publishing.

### P1: Package Output Contains Stale Build Artifacts

The published package would include files from old modules that are no longer in source.

Evidence:

- `npm --cache /tmp/ruleprobe-npm-cache pack --dry-run` reported 754 package files.
- The tarball file list includes stale `dist` artifacts such as removed command declaration maps and old semantic or runner files.
- `package.json` runs `tsc` for build but does not clean `dist`.
- `.npmignore` excludes source and tests but includes whatever is under `dist`.

Root cause:

Build output is incremental and package contents trust a dirty `dist` directory.

Suggested solution:

- Clean `dist` before every build, for example with a cross-platform clean script.
- Prefer an explicit `files` allowlist in `package.json` over broad `.npmignore` behavior.
- Add CI that runs a clean build, then `npm pack --dry-run`, then asserts the tarball contains only expected files.
- Consider generating declarations and maps into a fresh directory during release.

### P1: ESLint Rule Mapping Accuracy Is Not Proved

Several mapper entries appear semantically wrong or unverified against real ESLint rule metadata.

Evidence:

- `src/mapper/mappings/imports.ts` maps `no-wildcard-exports` to `import/no-namespace`, which is about namespace imports, not export star declarations.
- `no-namespace-imports` maps to `@typescript-eslint/consistent-type-imports`, which enforces type import style, not namespace imports.
- `mapMaxImportDepth` parses `maxDepth` but does not use it.
- `mapNoUnusedExports` maps to `no-unused-vars`, which is not an unused exports check across module boundaries.
- Some mapper tests assert expected strings but do not run ESLint or validate rule availability.

Root cause:

The mapper was built as a translation table without a rule metadata validation layer and without realistic lint fixtures for each matcher.

Suggested solution:

- Add a mapper validation suite that loads every referenced plugin and checks that every emitted rule exists.
- For each matcher, add one violating fixture and one passing fixture, then run ESLint using the generated config.
- Remove or mark unsupported any instruction that cannot map to a real ESLint rule.
- Keep deterministic RuleProbe checks for behaviors ESLint cannot represent.

### P1: The Repository Does Not Follow Its Own Instruction File

Several repository-level rules in `AGENTS.md` are currently not true for the project.

Evidence:

- `package.json` contains unpinned dependency ranges.
- No ESLint or Prettier config file was found at the repo root.
- `README.md` and `src/mappings/prose-templates.ts` are over 300 lines.
- Production source contains `console.log` in areas such as `src/dataset/github-client.ts`; action and CLI-facing code also use direct console output.

Root cause:

The instruction file is aspirational, but there is no self-check gate that enforces its deterministic parts against the repository.

Suggested solution:

- Decide which rules are policy and which are guidance.
- Add a self-check job that runs RuleProbe against `AGENTS.md` and fails only for implemented deterministic rules.
- Pin dependencies or update the instruction file if pinned versions are no longer a real policy.
- Add ESLint and Prettier configs or remove those requirements.
- Split long files where the 300-line rule is intended to be enforced.

### P2: Path Boundary Handling Is Inconsistent

Some commands resolve user paths safely, while newer command paths read and write raw paths.

Evidence:

- `parse` and `verify` use `resolveSafePath` for core inputs.
- `lint-config`, `drift`, and `extract` read user-supplied paths directly.
- `verify` resolves output paths directly rather than applying an explicit workspace output policy.

Root cause:

Safe path handling was implemented for older commands and not made a shared command boundary requirement.

Suggested solution:

- Add a command input helper that resolves, bounds, and describes allowed input and output paths.
- Apply it consistently to all CLI commands.
- Decide whether output files may be outside the workspace, and document that policy.
- Add tests for path traversal and symlink behavior for each command that touches the filesystem.

### P2: Config Validation And Error Handling Need Tightening

Configuration validation accepts unknown categories and verifiers, and some catches do not follow the repository's own error-handling policy.

Evidence:

- `src/config/loader.ts` checks that `category` and `verifier` are strings but does not validate them against known unions.
- Unknown verifier or pattern values can combine with verifier defaults to produce misleading pass results.
- Some catch clauses cast to `Error` instead of catching `unknown` and narrowing.
- At least one JSON parse catch in action code is intentionally silent.

Root cause:

Runtime config validation is shallow, and error handling rules are not enforced by linting.

Suggested solution:

- Add runtime validators for all public config shapes.
- Reject unknown categories, verifiers, pattern types, and severities with actionable messages.
- Add lint rules or review checks for `catch` clauses and empty catches.
- Where a parse failure is intentionally nonfatal, log the context at debug level or return an explicit fallback result.

## README Diagnosis

The README should be updated after the P0 implementation fixes, not before, unless it clearly labels broken paths as known limitations. The current README gives users confidence that the ESLint translation path is production-ready, but local generated artifacts contradict that.

Needed README changes:

- Replace the `.eslintrc.json` quick start with a format that the tool actually emits and validates.
- Remove or correct `verify --format summary`; use a currently supported format.
- Clarify whether RuleProbe is now primarily an ESLint translator, a deterministic verifier, or both.
- State the real matcher count and category count, and align `README.md`, `docs/matchers.md`, `docs/cli-reference.md`, `docs/api-reference.md`, and release notes.
- Remove claims that all remaining matchers emit valid ESLint rules until that is tested end to end.
- Update package, toolchain, language support, and GitHub Action examples to match implementation.
- Add known limitations for unmappable instructions, unsupported ESLint rules, semantic gaps, and archived commands.

## Recommended Fix Order

1. Fix ESLint emission and add end-to-end tests that parse generated configs and run ESLint on fixtures.
2. Decide parser policy for unmappable instructions, then stop generic rules from becoming false passes.
3. Migrate drift and extract to an async ESLint config loader with explicit extension support.
4. Fix GitHub Action CLI invocation and async config detection.
5. Clean `dist` before build, add package content checks, and validate mapper rule semantics with real ESLint runs.
6. Update README and docs only after behavior is corrected or explicitly marked unsupported.
7. Add self-check, safe path, and config validation coverage for the policies the project truly wants to enforce.

## Final Assessment

RuleProbe has useful pieces: a passing test suite, strict TypeScript compilation, a broad parser, and a clear product direction. The main debt is that the test suite validates too many internal strings and not enough user-visible artifacts. The next release should be treated as a contract-hardening release: generated configs must parse, documented commands must run, package contents must be clean, and unsupported rules must not pass silently.
