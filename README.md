<p align="center">
  <h1 align="center">RuleProbe</h1>
  <p align="center">
    Translate instruction files into ESLint configs, detect drift, and extract rules.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/ruleprobe"><img src="https://img.shields.io/npm/v/ruleprobe?style=flat-square" alt="npm version"></a>
    <a href="https://github.com/moonrunnerkc/ruleprobe/actions/workflows/self-check.yml"><img src="https://img.shields.io/github/actions/workflow/status/moonrunnerkc/ruleprobe/self-check.yml?style=flat-square&label=build" alt="build status"></a>
    <a href="https://github.com/moonrunnerkc/ruleprobe/blob/main/LICENSE"><img src="https://img.shields.io/github/license/moonrunnerkc/ruleprobe?style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square" alt="TypeScript">
    <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square" alt="Node.js >= 18">
    <a href="https://github.com/moonrunnerkc/ruleprobe/stargazers"><img src="https://img.shields.io/github/stars/moonrunnerkc/ruleprobe?style=flat-square" alt="GitHub stars"></a>
  </p>
</p>

## Why

AI coding agents read your `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`, but nothing checks whether your ESLint config actually enforces the same rules. Drift accumulates: the instruction file says "use camelCase" but ESLint never checks it, or ESLint enforces rules the instruction file never mentioned.

RuleProbe closes that gap. It reads your instruction file, extracts machine-verifiable rules, and bridges them to your tooling in three ways:

**Translate.** Generate an ESLint config from your instruction file. `ruleprobe lint-config CLAUDE.md` produces a flat or legacy config you can drop into your project immediately.

**Detect drift.** Compare your instruction file against an existing ESLint config. `ruleprobe drift CLAUDE.md .eslintrc.json` reports rules present in one but missing from the other, severity mismatches, and config argument differences.

**Extract.** Pull a rules section out of an ESLint config for pasting into an instruction file. `ruleprobe extract .eslintrc.json` converts ESLint rules back into human-readable instruction prose.

## Quick Start

```bash
npm install -g ruleprobe
```

Or run it directly:

```bash
npx ruleprobe --help
```

**Translate an instruction file to ESLint config:**

```bash
ruleprobe lint-config CLAUDE.md
ruleprobe lint-config AGENTS.md --format legacy --output .eslintrc.json
```

**Detect drift between instructions and ESLint:**

```bash
ruleprobe drift CLAUDE.md .eslintrc.json
ruleprobe drift CLAUDE.md .eslintrc.json --format markdown
```

**Extract rules from an ESLint config:**

```bash
ruleprobe extract .eslintrc.json
ruleprobe extract .eslintrc.json --output rules-section.md
```

**Parse an instruction file** to see what rules RuleProbe can extract:

```bash
ruleprobe parse CLAUDE.md
ruleprobe parse AGENTS.md --show-unparseable
```

**Verify agent output** against extracted rules (legacy mode). Valid formats: `text`, `json`, `markdown`, `rdjson`, `summary`, `detailed`, `ci`.

```bash
ruleprobe verify CLAUDE.md ./agent-output --format text
ruleprobe verify AGENTS.md ./src --changed-since origin/main
```

## What It Does

**Translate.** Reads 7 instruction file formats (CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, GEMINI.md, .windsurfrules, .rules) and emits an ESLint config. Flat config is the default; pass `--format legacy` for `.eslintrc.json` output. Each extractable rule maps to an ESLint rule with appropriate severity and options. Rules that have no ESLint equivalent appear as comments in the output so you know what wasn't covered.

**Detect drift.** Compares parsed rules against an existing ESLint config. Reports rules in the instruction file but missing from ESLint (you're not enforcing what you said), rules in ESLint but not in the instructions (you're enforcing what you never stated), severity mismatches, and argument differences. Use `--format markdown` for PR-ready output.

**Extract.** Parses an ESLint config and generates a markdown rules section you can paste into an instruction file. Stylistic rules (semicolons, quotes) are reported but skipped from the output by default since they don't carry meaningful instruction content.

**Parse.** Extracts machine-verifiable rules from instruction files with qualifiers (`always`, `prefer`, `when-possible`, `avoid-unless`, `try-to`, `never`) and section context. Subjective lines like "write clean code" are reported as unparseable.

**Verify.** Runs extracted rules against a directory of code. Deterministic by default, optional semantic analysis available. The original mode, still supported but no longer the primary focus.

**Analyze.** Discovers all instruction files in a project, parses each, and cross-references them for conflicts and redundancies. Pass `--semantic` for structural pattern analysis.

## Configuration

RuleProbe auto-discovers a config file in the working directory (or any parent). You can also pass `--config <path>` explicitly. Supported file names, in priority order:

- `ruleprobe.config.ts`
- `ruleprobe.config.js`
- `ruleprobe.config.json`
- `.ruleproberc.json`

A config file lets you add custom rules, override extracted rules, or exclude rules entirely:

```typescript
// ruleprobe.config.ts
import { defineConfig } from 'ruleprobe';

export default defineConfig({
  // Add rules that the parser can't extract from your instruction file
  rules: [
    {
      id: 'custom-no-lodash',
      category: 'import-pattern',
      description: 'Ban lodash imports',
      verifier: 'regex',
      pattern: { type: 'banned-import', target: '*.ts', expected: 'lodash', scope: 'file' },
    },
  ],

  // Change severity or expected values on extracted rules
  overrides: [
    { ruleId: 'naming-camelcase', severity: 'warning' },
    { ruleId: 'structure-max-file-length', expected: '500' },
  ],

  // Remove rules you don't want checked
  exclude: ['forbidden-no-console-log'],
});
```

`defineConfig()` is a no-op passthrough that provides type checking in TypeScript configs. JSON configs work without it.

Custom rules use the same verifier types (`ast`, `regex`, `filesystem`) and pattern types as extracted rules.

## CLI Reference

Six commands: `parse`, `verify`, `analyze`, `lint-config`, `drift`, `extract`.

```bash
ruleprobe parse CLAUDE.md --show-unparseable
ruleprobe verify AGENTS.md ./src --format detailed --threshold 0.9
ruleprobe lint-config CLAUDE.md --format flat --output eslint.config.js
ruleprobe drift CLAUDE.md .eslintrc.json --format markdown
ruleprobe extract .eslintrc.json --output rules-section.md
ruleprobe analyze ./my-project --format json
```

Full command reference with all options: [docs/cli-reference.md](docs/cli-reference.md)

### Incremental verification with `--changed-since`

`ruleprobe verify` accepts `--changed-since <git-ref>` to limit per-file checks to files changed between the given ref and `HEAD`. Useful on PRs where you only want to enforce rules on the new diff and not surface pre-existing violations.

```bash
ruleprobe verify AGENTS.md ./src --changed-since origin/main
ruleprobe verify AGENTS.md ./src --changed-since $(git merge-base HEAD origin/main)
```

The flag runs `git diff --name-only --diff-filter=ACMR <ref>...HEAD` (added, copied, modified, renamed; deleted files are excluded). Project-level rules (`changelog-exists`, `strict-mode`, etc.) still run regardless of the diff. Cross-file rules like `test-files-exist` see the full file list so they can find a test file even when the test itself was not changed.

If git is not on `PATH` or the ref is invalid, `verify` exits with code 2 and a descriptive message.

## GitHub Action

Drop this into `.github/workflows/ruleprobe.yml`:

```yaml
name: RuleProbe Drift
on: [pull_request]
jobs:
  drift-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: moonrunnerkc/ruleprobe@v4
        with:
          instruction-file: CLAUDE.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

No API keys needed, deterministic results, runs in seconds. The action only runs drift detection when instruction files or ESLint config files change in the PR. `@v4` tracks the latest v4.x release; pin to a specific tag (e.g., `@v4.5.0`) for reproducible builds.

<details>
<summary>Full action options</summary>

```yaml
- uses: moonrunnerkc/ruleprobe@v4
  with:
    mode: drift
    instruction-file: CLAUDE.md
    eslint-file: .eslintrc.json
    regenerate-on-drift: "false"
    comment-on-pr: "true"
    fail-on-drift: "false"
```

| Input | Default | Description |
|-------|---------|-------------|
| `mode` | `drift` | Run mode: `drift` (default) or `verify` (legacy) |
| `instruction-file` | (required) | Path to instruction file |
| `eslint-file` | (auto-detected) | Path to ESLint config file |
| `regenerate-on-drift` | `false` | Open a follow-up PR with regenerated config when drift is detected |
| `comment-on-pr` | `true` | Post drift results as a PR comment |
| `fail-on-drift` | `false` | Fail the action if drift is detected |
| `changed-since` | (unset) | Verify mode only. Git ref to diff against; only files changed in `<ref>...HEAD` are checked per-file |

Drift mode outputs: `drift-count`, `has-drift`.

</details>

### Verify mode with incremental diff

To run `verify` on the PR diff only — surfacing new violations without flagging pre-existing ones — set `mode: verify` and pass the PR base SHA via `changed-since`:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # full history so the base SHA is reachable
- uses: moonrunnerkc/ruleprobe@v4
  with:
    mode: verify
    instruction-file: AGENTS.md
    output-dir: src
    changed-since: ${{ github.event.pull_request.base.sha }}
```

`fetch-depth: 0` is required because `actions/checkout` defaults to a shallow clone and the base SHA may not be present in a shallow history.

## Programmatic API

Core pipeline functions are exported for programmatic use:

```typescript
import { parseInstructionFile, verifyOutput, generateReport, formatReport } from 'ruleprobe';

const ruleSet = parseInstructionFile('CLAUDE.md');
const results = await verifyOutput(ruleSet, './agent-output');
const report = generateReport(
  { agent: 'claude-code', model: 'opus-4', taskTemplateId: 'manual',
    outputDir: './agent-output', timestamp: new Date().toISOString(), durationSeconds: null },
  ruleSet,
  results,
);
console.log(formatReport(report, 'summary'));
```

Full API reference: [docs/api-reference.md](docs/api-reference.md)

## How It Works

```
Instruction File --> Rule Parser --> RuleSet --+
                                               +--> Verifier --> Adherence Report
                        Agent Output ---------+

Instruction File --> Rule Parser --> RuleSet --> Mapper --> ESLint Config

Instruction File --> Rule Parser --> RuleSet --+
ESLint Config     --> Parser     --> Parsed --+--> Drift Report

ESLint Config     --> Extractor --> Markdown Rules Section
```

The parser reads your instruction file and identifies lines that map to deterministic checks. Each rule gets a category, a verifier type, a pattern, and a qualifier (how strictly the instruction is worded). Three verifier engines handle different rule types:

| Engine | What it checks |
|--------|---------------|
| AST (ts-morph) | Code structure, naming, type safety, imports for TypeScript/JavaScript |
| Filesystem | File existence, naming conventions, directory structure |
| Regex | Content patterns, forbidden strings |

The mapper translates extractable rules into ESLint rule entries. The drift detector compares parsed rules against an existing ESLint config. The extractor reverses the mapping: ESLint rules become human-readable instruction prose.

## Supported Rule Types

34 mappable matchers across 7 categories produce ESLint config entries:

| Category | Count | Verifier | Examples |
|----------|------:|----------|----------|
| naming | 5 | AST, Filesystem | camelCase variables, PascalCase types, kebab-case files, UPPER_CASE constants |
| forbidden-pattern | 5 | AST, Regex | no `any`, no `console.log`, no `var`, max line length, no `TODO` comments |
| structure | 4 | AST, Filesystem | named exports, JSDoc required, max file length, no unused exports |
| import-pattern | 4 | AST | no path aliases, no deep relative imports, no namespace imports, no wildcard exports |
| error-handling | 2 | AST | no empty catch, throw Error only |
| type-safety | 5 | AST, Regex | no enums, no type assertions, no non-null assertions, no implicit any, no ts directives |
| code-style | 9 | AST, Regex | prefer const, no else after return, no nested ternary, no magic numbers, semicolons, quotes, max function length, max params, no TODO comments |

Rules that can't map to ESLint (test file requirements, project config, git conventions) are reported as unmappable so you can enforce them through other tooling.

Full matcher details: [docs/matchers.md](docs/matchers.md)

## Security

RuleProbe never executes scanned code, never makes network calls (unless you opt in with `--llm-extract`, `--rubric-decompose`, or `--semantic`), and never modifies files in the scanned directory. User-supplied paths are resolved and bounded to the working directory; symlinks outside the project are skipped unless you pass `--allow-symlinks`. All dependencies are pinned to exact versions.

When `--semantic` is enabled, all analysis runs locally. The only network calls are to the Anthropic API for LLM judgment when vector similarity is ambiguous (using your own `ANTHROPIC_API_KEY`). Only numeric AST vectors, opaque sub-tree hashes, boolean flags, and rule text are sent to the LLM. No source code, variable names, comments, import paths, or file paths leave the machine. See [SECURITY.md](SECURITY.md) for the full model.

## Limitations

- **Not all rules map to ESLint.** Test file requirements, project config conventions, git workflow rules, and preference pairs don't have ESLint equivalents. These are reported as unmappable so you can enforce them through other tooling.
- **Monorepo support is limited.** Drift detection and lint-config scan from the repository root and use the first ESLint config found. Monorepos with per-package instruction files or configs need to specify paths explicitly.

## What's New in v4.5.0

v4.5.0 pivots RuleProbe from "verify adherence" to "translate instruction files into ESLint configs." The core value proposition is now: translate, detect drift, extract.

Key changes:
- **New commands**: `lint-config` (translate instructions → ESLint config), `drift` (compare instructions vs an existing ESLint config), `extract` (ESLint config → instruction prose).
- **Removed**: `compare`, `tasks`, `task`, `run`, the runner module exports (`buildAgentConfig`, `invokeAgent`, `watchForCompletion`, `countCodeFiles`).
- **Deprecated**: `verify` still works, but the primary workflow is now lint-config, drift, and extract.
- **Matcher audit**: 34 ESLint-mappable matchers remain across 7 categories (`naming`, `forbidden-pattern`, `structure`, `import-pattern`, `error-handling`, `type-safety`, `code-style`). 67 unmappable matchers and the `test-requirement`, `dependency`, `preference`, `file-structure`, `tooling`, `testing`, and `workflow` categories were removed.

## Contributing

```bash
git clone https://github.com/moonrunnerkc/ruleprobe.git
cd ruleprobe && npm install
npm test
```

Issues and pull requests welcome at [github.com/moonrunnerkc/ruleprobe](https://github.com/moonrunnerkc/ruleprobe).

## License

[MIT](LICENSE)