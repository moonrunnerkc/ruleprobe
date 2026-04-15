<p align="center">
  <h1 align="center">RuleProbe</h1>
  <p align="center">
    Verify whether AI coding agents actually follow the instruction files they're given.
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

Every AI coding agent reads an instruction file. None of them prove they followed it.

You write `CLAUDE.md` or `AGENTS.md` with specific rules: camelCase variables, no `any` types, named exports only, test files for every source file. The agent says "Done." But did it actually follow them? Your code review catches some violations, misses others, and doesn't scale.

RuleProbe reads the same instruction file, extracts the machine-verifiable rules, and checks agent output against each one. Compliance scores with file paths and line numbers as evidence. Deterministic and reproducible by default. Optional semantic analysis (paid tier) handles pattern-matching and consistency rules that require codebase-aware judgment.

## Quick Start

```bash
npm install -g ruleprobe
```

Or run it directly:

```bash
npx ruleprobe --help
```

**Parse an instruction file** to see what rules RuleProbe can extract:

```bash
ruleprobe parse CLAUDE.md
ruleprobe parse AGENTS.md --show-unparseable
```

**Verify agent output** against those rules:

```bash
ruleprobe verify CLAUDE.md ./agent-output --format text
ruleprobe verify AGENTS.md ./src --format summary --threshold 0.9
```

**Analyze a whole project** across all instruction files:

```bash
ruleprobe analyze ./my-project
```

Every failure includes the file, line number, and what was found. Preference rules return compliance ratios instead of binary pass/fail.

## What It Does

**Parse.** Reads 7 instruction file formats (CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, GEMINI.md, .windsurfrules, .rules) and extracts rules that can be checked mechanically. Each rule gets a qualifier (`always`, `prefer`, `when-possible`, `avoid-unless`, `try-to`, `never`) detected from the instruction text, and the markdown section it came from. Subjective instructions like "write clean code" are reported as unparseable so you know what was skipped.

**Verify.** Runs each extracted rule against a directory of agent-generated code. Eight verifier engines: AST (ts-morph), filesystem, regex, tree-sitter (TypeScript, JavaScript, Python, Go), preference (compliance ratios for "prefer X over Y" patterns), tooling (package.json/lockfile/config checks), config-file (linter/formatter/build tool configs), and git-history (commit message and workflow checks). No LLM evaluation by default; results are deterministic.

**Analyze.** Discovers all instruction files in a project, parses each, and cross-references them. Detects conflicts (same topic, contradictory rules across files) and redundancies (same rule in multiple files). Returns a coverage map showing which categories each file addresses. Pass `--semantic` with a license key to add structural pattern analysis via the paid semantic tier.

**LLM Extract (opt-in).** Pass `--llm-extract` to send unparseable lines through an OpenAI-compatible API. LLM-extracted rules are labeled with `extractionMethod: 'llm'` and `confidence: 'medium'`. Requires `OPENAI_API_KEY`.

**Compare.** Point RuleProbe at outputs from two or more agents and get a side-by-side comparison table showing which rules each one followed.

**GitHub Action.** Composite action for any repo. Runs `ruleprobe verify` on every PR, posts results as a comment, and optionally outputs reviewdog rdjson format for inline annotations.

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

Custom rules use the same verifier types (`ast`, `regex`, `filesystem`, `treesitter`, `preference`, `tooling`, `config-file`, `git-history`) and pattern types as extracted rules. Any pattern type listed in the Supported Rule Types table works as a custom rule pattern.

## CLI Reference

Seven commands: `parse`, `verify`, `analyze`, `compare`, `tasks`, `task`, `run`. Quick examples:

```bash
ruleprobe parse CLAUDE.md --show-unparseable
ruleprobe verify AGENTS.md ./src --format summary --threshold 0.9
ruleprobe analyze ./my-project --format json
ruleprobe compare AGENTS.md ./claude-output ./copilot-output --agents claude,copilot
ruleprobe tasks
ruleprobe task rest-endpoint
ruleprobe run CLAUDE.md --task rest-endpoint --agent claude-code --format text
```

The `analyze` command supports semantic analysis flags (`--semantic`, `--license-key`, `--cost-report`, `--semantic-log`) for the paid tier.

Full command reference with all options: [docs/cli-reference.md](docs/cli-reference.md)

## GitHub Action

Drop this into `.github/workflows/ruleprobe.yml`:

```yaml
name: RuleProbe
on: [pull_request]
jobs:
  check-rules:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: moonrunnerkc/ruleprobe@v2
        with:
          instruction-file: AGENTS.md
          output-dir: src
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

No API keys needed, deterministic results, runs in seconds.

> **Note:** `@v2` tracks the latest v2.x release. Pin to a specific tag (e.g., `@v2.0.0`) for reproducible builds.

<details>
<summary>Full action options</summary>

```yaml
- uses: moonrunnerkc/ruleprobe@v2
  with:
    instruction-file: AGENTS.md
    output-dir: src
    agent: ci
    model: unknown
    format: text
    severity: all
    fail-on-violation: "true"
    post-comment: "true"
    reviewdog-format: "false"
```

| Input | Default | Description |
|-------|---------|-------------|
| `instruction-file` | (required) | Path to instruction file |
| `output-dir` | `src` | Directory containing code to verify |
| `agent` | `ci` | Agent identifier for report metadata |
| `model` | `unknown` | Model identifier for report metadata |
| `format` | `text` | Report format: text, json, or markdown |
| `severity` | `all` | Filter: error, warning, or all |
| `fail-on-violation` | `true` | Fail the check on any violation |
| `post-comment` | `true` | Post results as a PR comment |
| `reviewdog-format` | `false` | Also output rdjson for reviewdog |

Outputs: `score`, `passed`, `failed`, `total` (available to downstream steps).

</details>

## Programmatic API

Core pipeline functions, project analysis, config, LLM extraction, and agent invocation are all exported:

```typescript
import { parseInstructionFile, verifyOutput, generateReport, formatReport } from 'ruleprobe';

const ruleSet = parseInstructionFile('CLAUDE.md');
const results = await verifyOutput(ruleSet, './agent-output');
const report = generateReport(
  { agent: 'claude-code', model: 'opus-4', taskTemplateId: 'rest-endpoint',
    outputDir: './agent-output', timestamp: new Date().toISOString(), durationSeconds: null },
  ruleSet,
  results,
);
console.log(formatReport(report, 'summary'));
```

Full API reference with all exported functions and types: [docs/api-reference.md](docs/api-reference.md)

## How It Works

```
  Instruction File --> Rule Parser --> RuleSet --+
                                                 +--> Verifier --> Adherence Report
                          Agent Output ----------+
```

The parser reads your instruction file and identifies lines that map to deterministic checks. Each rule gets a category, a verifier type, a pattern, and a qualifier (how strictly the instruction is worded). Eight verifier engines handle different rule types:

| Engine | What it checks |
|--------|---------------|
| AST (ts-morph) | Code structure, naming, type safety, imports for TypeScript/JavaScript |
| Filesystem | File existence, naming conventions, directory structure |
| Regex | Content patterns, forbidden strings, test conventions |
| Tree-sitter | Naming and function-length checks for TypeScript, JavaScript, Python, Go |
| Preference | Compliance ratios for "prefer X over Y" patterns (8 built-in pairs) |
| Tooling | Package manager, test runner, linter/formatter presence in package.json and lockfiles |
| Config-file | Linter, formatter, and build tool configuration file contents |
| Git-history | Commit message conventions, branch naming, workflow patterns |

The report collects compliance scores with evidence for every rule.

## Supported Rule Types

102 built-in matchers across 14 categories:

| Category | Count | Verifier(s) | Examples |
|----------|------:|-------------|----------|
| naming | 9 | AST, Filesystem, Tree-sitter | camelCase variables, PascalCase types, kebab-case files |
| forbidden-pattern | 5 | AST, Regex | no `any`, no `console.log`, no `eval` |
| structure | 9 | AST, Filesystem | strict mode, named exports, JSDoc, max file length |
| test-requirement | 5 | AST, Filesystem, Regex | test file existence, test naming conventions |
| import-pattern | 5 | AST, Regex | no path aliases, no barrel imports, no wildcard imports |
| error-handling | 4 | AST | no empty catch, no swallowed errors, typed catches, error boundaries |
| type-safety | 6 | AST, Regex | no type assertions, no non-null assertions, no enums |
| code-style | 12 | AST, Regex, Tree-sitter | early returns, no magic numbers, no nested ternaries |
| dependency | 2 | Filesystem | pinned dependency versions, lockfile presence |
| preference | 8 | Preference | const over let, named over default exports, interface over type, async/await over .then() |
| file-structure | 5 | Filesystem | tests directory, components directory, .env file, module index files |
| tooling | 14 | Tooling | pnpm/yarn/bun, vitest/jest/pytest, eslint/prettier/biome, bundler configs |
| testing | 3 | Filesystem, Regex | test colocation, describe/it blocks, no console in tests |
| workflow | 15 | Config-file, Git-history | commit conventions, CI configs, linter/formatter settings, build tool configs |

Full table with example instructions and check details: [docs/matchers.md](docs/matchers.md)

### Compliance scoring

Every rule result includes a `compliance` field (0 to 1):

- **Deterministic checks** (file exists, no `any` types): compliance is 0 or 1
- **Preference checks** (prefer const over let): compliance is the ratio (0.85 = 85% const usage)
- **Coverage checks** (test colocation): compliance is the percentage of source files with tests
- **Tooling checks**: compliance is 1 if present, 0.5 if present with a competitor, 0 if absent

The `--threshold` option (default 0.8) controls what compliance level counts as passing.

## Semantic Analysis (Paid Tier)

The deterministic engine handles rules with clear patterns. Rules like "follow existing patterns," "maintain consistency," or qualified rules ("when possible," "avoid unless") require codebase-aware judgment. The semantic tier handles these.

**How it works:** RuleProbe extracts raw AST vectors locally (node type counts, sub-tree hashes, nesting depths). No source code, variable names, comments, or file paths ever leave your machine. The vectors are sent to the RuleProbe API service, which runs structural fingerprinting and similarity analysis to score compliance. An LLM is consulted only when vector similarity is ambiguous, and it receives only numeric data with rule text, never code.

```bash
ruleprobe analyze ./my-project --semantic --license-key <key>
ruleprobe analyze ./my-project --semantic --license-key <key> --cost-report
```

| Flag | Description |
|------|-------------|
| `--semantic` | Enable semantic analysis (requires license key) |
| `--license-key <key>` | License key (also: `RULEPROBE_LICENSE_KEY` env var or `.ruleprobe/config.json`) |
| `--max-llm-calls <n>` | Cap LLM calls per analysis (default: 20) |
| `--no-cache` | Disable profile caching |
| `--semantic-log` | Print what was sent/received to stdout |
| `--cost-report` | Show token cost breakdown |

Without `--semantic`, the analyze command runs deterministic analysis only. If the license key is invalid or the API is unreachable, semantic analysis is skipped gracefully and deterministic results are still returned.

## Authentication

Most of RuleProbe works offline with no API keys. Opt-in features that use external APIs:

| Feature | Flag(s) | Required env var | When you need it |
|---------|---------|-----------------|------------------|
| LLM rule extraction | `--llm-extract` | `OPENAI_API_KEY` | Extracting rules from unparseable instruction lines |
| Rubric decomposition | `--rubric-decompose` | `OPENAI_API_KEY` | Breaking subjective rules into concrete checks |
| Semantic analysis | `--semantic` | `RULEPROBE_LICENSE_KEY` | Structural pattern and consistency checks |
| Agent invocation (SDK mode) | `ruleprobe run --agent claude-code` | `ANTHROPIC_API_KEY` | Invoking Claude to generate code, then verifying |
| GitHub Action | `uses: moonrunnerkc/ruleprobe@v2` | `GITHUB_TOKEN` | CI, PR comments |

`parse`, `verify`, `compare`, `tasks`, and `task` work entirely offline. `analyze` works offline for deterministic analysis; `--semantic` requires an active license key and network access.

## Tree-sitter Support

TypeScript, JavaScript, Python, and Go get naming and function-length checks via tree-sitter WASM grammars. The grammar packages (`tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-python`, `tree-sitter-go`, `web-tree-sitter`) ship as regular dependencies; no extra install step is required. WASM binaries are loaded at runtime from the installed packages. If loading fails (unsupported platform, missing native build), tree-sitter checks are skipped and other verifiers still run.

## Security

RuleProbe never executes scanned code, never makes network calls (unless you opt in with `--llm-extract`, `--rubric-decompose`, `--semantic`, or `ruleprobe run`), and never modifies files in the scanned directory. User-supplied paths are resolved and bounded to the working directory; symlinks outside the project are skipped unless you pass `--allow-symlinks`. All dependencies are pinned to exact versions.

When `--semantic` is enabled, only numeric AST vectors, opaque sub-tree hashes, boolean flags, and rule text are transmitted. No source code, variable names, comments, import paths, or file paths leave the machine. See [SECURITY.md](SECURITY.md) for the full model.

## Limitations

- **TypeScript gets the deepest coverage.** ts-morph gives full AST analysis for TypeScript and JavaScript across all 14 categories. Python, Go, TypeScript, and JavaScript get naming and function-length checks via tree-sitter. No Rust, Java, or C# AST support yet.
- **Subjective rules stay subjective.** "Write clean code" has no deterministic check. `--rubric-decompose` uses an LLM to break subjective instructions into weighted concrete checks, tagged with `confidence: 'low'`. Lines with no measurable proxy stay in the unparseable array. Requires `OPENAI_API_KEY`.
- **Agent invocation covers Claude SDK and watch mode only.** The `run` command invokes agents via the Claude Agent SDK or watches a directory for output. Copilot, Cursor, and other agent SDKs are not integrated; use `--watch` mode for those.
- **Type-aware checks require --project.** Three checks (implicit any, unused exports, unresolved imports) need a `tsconfig.json`. Without `--project`, ts-morph parses files in isolation and these checks are skipped.
- **102 matchers, not infinite.** The parser skips lines it can't confidently map to a check. Use `--show-unparseable` to see what was missed, and `--llm-extract` or `--rubric-decompose` to handle the remainder. The semantic tier (`--semantic`) covers pattern-matching and consistency rules that deterministic matchers cannot.
- **Preference pairs are TypeScript-focused.** The 8 built-in prefer-pairs (const vs let, named vs default exports, etc.) use ts-morph AST queries. Adding pairs for other languages requires new counting functions.

## Troubleshooting

**`sh: ruleprobe: not found` after global install**
The npm bin directory may not be in `PATH`. Run `npm bin -g` to find it and add it to your shell profile, or use `npx ruleprobe` instead.

**`Error: OPENAI_API_KEY not set`**
`--llm-extract` and `--rubric-decompose` require an OpenAI-compatible API key. Export it before running: `export OPENAI_API_KEY=sk-...`. The key is never written to disk or included in reports.

**Tree-sitter checks skipped**
The WASM grammars load from installed tree-sitter grammar packages. If packages are missing (e.g., after a partial install) or the platform doesn't support WASM, tree-sitter checks silently fall back and other verifiers still run. Re-run `npm install` to restore them.

**`ruleprobe verify` exits 2 with "path outside project root"**
A file or symlink in the output directory resolves outside the project root. Pass `--allow-symlinks` to follow symlinks across boundaries, or move the symlink targets inside the project.

**Fewer rules extracted than expected**
Run `ruleprobe parse <instruction-file> --show-unparseable` to see which lines were skipped and why. Add `--llm-extract` to attempt extraction on skipped lines.

**Semantic analysis skipped / license key errors**
Verify your license key is set via `--license-key`, `RULEPROBE_LICENSE_KEY` env var, or `.ruleprobe/config.json`. Check that the API endpoint is reachable. Deterministic analysis always runs regardless of semantic tier status.

## What's New in v3.0.0

v3.0.0 adds the **semantic analysis tier** (ASPE), fixes 12 root-cause bugs found during E2E validation, and delivers a batch AST verifier that drops parse complexity from O(rules * files) to O(files).

Key changes:
- **Semantic client** (`src/semantic/`): single-pass tree-sitter extraction, HTTP client, audit logging, license/config resolution. No source code leaves the machine.
- **Batch AST verifier**: parse each file once across all AST rules. Critical for large repos (PostHog: 7,000+ files).
- **Tree-sitter WASM stability**: parser caching prevents function table exhaustion on large codebases.
- **12 bug fixes**: tree-sitter crashes, O(rules*files) performance, matcher wiring, format routing, enum comparison, header mismatches, JSON corruption. All root-cause resolutions.
- **Calibration data**: measured on excalidraw (626 files) and PostHog (7,160 files). Fast-path threshold 0.85 confirmed. Jaccard/cosine weights 0.4/0.6 confirmed.
- **864 tests** across 68 files (up from 572 across 52 in v2.0.0).

Full release notes and migration guide: [docs/release-v3.0.0.md](docs/release-v3.0.0.md)

## Benchmarks

**Corpus analysis: 202 instruction files from 195 repos.** RuleProbe parsed real CLAUDE.md, AGENTS.md, .cursorrules, and GEMINI.md files scraped from public GitHub repos (ClickHouse, Grafana, Microsoft, Deno, PostHog, Expo, and others). 917 rules extracted from 167 substantive files, averaging 5.5 rules per file. The other 35 files were single-line pointers or redirects, which the parser correctly skipped.

The raw parse rate is 13%, which sounds low until you look at what instruction files actually contain. About 87% of the lines in a typical instruction file are markdown headers, code examples, project descriptions, build commands, and contextual prose. The parser isn't failing on those; it's correctly identifying them as not-rules. Nearly half the substantive files (44.9%) had parse rates above 20%, and the bottom of the distribution is dominated by documentation-heavy files from large orgs that embed a few rules in pages of project context.

Full report: [docs/verification/e2e-verification-report.md](docs/verification/e2e-verification-report.md)

**E2E verification: 5 repos, 52 rules.** RuleProbe ran the full deterministic + semantic pipeline against excalidraw (~95k stars), PostHog (~25k), Codex (~21k), Zed (~57k), and Cline (~23k). Results:

| Repo | Rules | Passed | Compliance |
|------|------:|-------:|-----------:|
| excalidraw | 16 | 13 | 81.2% |
| posthog | 15 | 12 | 80.0% |
| codex | 9 | 8 | 88.9% |
| zed | 7 | 7 | 100.0% |
| cline | 5 | 4 | 80.0% |
| **Total** | **52** | **44** | **84.6%** |

73% of the rules (38/52) turned out to be non-structural: tooling commands ("use npm run compile not npm run build"), agent behavior directives ("be succinct"), workflow patterns, and framework-specific guidance with no AST representation. This matches the corpus finding that most instruction file content isn't about code patterns.

For the 10 rules the semantic tier could resolve structurally, 60% hit the fast path (structural similarity alone, zero LLM calls). The remaining 40% escalated to LLM judgment and returned nuanced scores: excalidraw's functional component preference scored 0.82, PascalCase type naming 0.85, async try/catch usage 0.85. Total cost across all 5 repos: $0.06.

Per-repo details: [excalidraw](docs/verification/e2e-verification-report.md#2-excalidraw-ruleprobe-analyze---semantic) | [posthog](docs/verification/e2e-verification-report.md#3-posthog-ruleprobe-analyze---semantic) | codex | zed | cline

## Further Reading

- [docs/cli-reference.md](docs/cli-reference.md) - Complete CLI command reference
- [docs/api-reference.md](docs/api-reference.md) - Programmatic API with types
- [docs/matchers.md](docs/matchers.md) - All 102 matchers with example instructions
- [docs/release-v3.0.0.md](docs/release-v3.0.0.md) - v3.0.0 release notes and migration guide
- [docs/release-v2.0.0.md](docs/release-v2.0.0.md) - v2.0.0 release notes
- [docs/case-study-v0.1.0.md](docs/case-study-v0.1.0.md) - Agent comparison case study
- [docs/verification/e2e-verification-report.md](docs/verification/e2e-verification-report.md) - E2E verification evidence

## Contributing

```bash
git clone https://github.com/moonrunnerkc/ruleprobe.git
cd ruleprobe && npm install
npm test
```

Issues and pull requests welcome at [github.com/moonrunnerkc/ruleprobe](https://github.com/moonrunnerkc/ruleprobe).

## License

[MIT](LICENSE)
