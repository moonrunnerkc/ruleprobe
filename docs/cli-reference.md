# CLI Reference

Complete reference for all RuleProbe CLI commands and options.

## `ruleprobe parse <instruction-file>`

Extract rules from an instruction file.

```bash
ruleprobe parse CLAUDE.md --format json
ruleprobe parse AGENTS.md --show-unparseable
ruleprobe parse AGENTS.md --llm-extract --show-unparseable
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `json` or `text` |
| `--show-unparseable` | `false` | Include lines that could not be converted to rules |
| `--llm-extract` | `false` | Send unparseable lines to an OpenAI-compatible API for additional extraction (requires `OPENAI_API_KEY`) |

---

## `ruleprobe verify <instruction-file> <output-dir>`

Parse rules from an instruction file. Verify agent output against them.

```bash
ruleprobe verify CLAUDE.md ./output --format text
ruleprobe verify AGENTS.md ./output --format summary --threshold 0.9
ruleprobe verify AGENTS.md ./output --agent claude --model opus-4 --format json --output report.json
ruleprobe verify AGENTS.md ./output --format detailed --severity error
ruleprobe verify AGENTS.md ./output --format ci
ruleprobe verify AGENTS.md ./output --format rdjson
ruleprobe verify AGENTS.md ./output --config ruleprobe.config.ts
ruleprobe verify AGENTS.md ./output --llm-extract
ruleprobe verify AGENTS.md ./output --rubric-decompose
ruleprobe verify AGENTS.md ./output --project tsconfig.json
ruleprobe verify AGENTS.md ./output --changed-since origin/main
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | `text`, `json`, `markdown`, `rdjson`, `summary`, `detailed`, or `ci` |
| `--threshold <number>` | `0.8` | Compliance threshold (0-1) for pass/fail determination |
| `--agent <name>` | `unknown` | Agent identifier for report metadata |
| `--model <name>` | `unknown` | Model identifier for report metadata |
| `--task <template-id>` | `manual` | Which task template was used |
| `--severity <level>` | `all` | Filter: `error`, `warning`, or `all` |
| `--output <path>` | stdout | Write report to file |
| `--config <path>` | auto-discovered | Path to config file |
| `--llm-extract` | `false` | Run LLM extraction on unparseable lines (requires `OPENAI_API_KEY`) |
| `--rubric-decompose` | `false` | Decompose subjective rules via LLM (requires `OPENAI_API_KEY`) |
| `--project <tsconfig>` | none | tsconfig.json path for type-aware checks |
| `--allow-symlinks` | `false` | Follow symlinks outside the working directory |
| `--changed-since <ref>` | none | Only verify files changed since the given git ref (e.g., `origin/main`) |

**Format highlights:** `summary` outputs a compact per-category table. `detailed` shows per-rule compliance percentages with evidence. `ci` produces key=value output with GitHub Actions `::error` annotations. `rdjson` produces reviewdog-compatible JSON.

**`--changed-since <git-ref>`:** runs `git diff --name-only --diff-filter=ACMR <ref>...HEAD` (added, copied, modified, renamed; deletions excluded) and limits per-file checks to that set. Project-level rules (`changelog-exists`, `strict-mode`, etc.) still run. Cross-file rules like `test-files-exist` see the full file tree, so a missing test for a changed source file is still reported even when the test file itself is unchanged. The flag is opt-in: omit it and `verify` checks every file under `<output-dir>`. Requires `git` on `PATH` and the working directory to be inside a git repo with at least one commit. Exits with code 2 and a descriptive message if either is missing.

**Exit codes:** `0` all rules passed, `1` violations found, `2` execution error.

---

## `ruleprobe analyze <project-dir>`

Discover all instruction files in a project, parse each, and report cross-file conflicts and redundancies.

```bash
ruleprobe analyze ./my-project --format text
ruleprobe analyze ./my-project --format json --output analysis.json
ruleprobe analyze ./my-project --semantic
ruleprobe analyze ./my-project --semantic --cost-report --semantic-log
```

Checks for `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`, and `.rules` at the project root. Reports per-file rule counts, cross-file conflicts (same topic, contradictory instructions), redundancies (same rule in multiple files), and a category coverage map.

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text` or `json` |
| `--output <path>` | stdout | Write report to file |
| `--threshold <number>` | `0.8` | Compliance threshold (0-1) for CI pass/fail |
| `--semantic` | `false` | Enable semantic analysis (requires `ANTHROPIC_API_KEY`) |
| `--anthropic-key <key>` | none | Anthropic API key (also: env `ANTHROPIC_API_KEY` or `.ruleprobe/config.json`) |
| `--max-llm-calls <n>` | `20` | Maximum LLM calls per semantic analysis |
| `--no-cache` | `false` | Disable profile caching |
| `--semantic-log` | `false` | Print semantic analysis log to stdout after results |
| `--cost-report` | `false` | Show token cost breakdown for semantic analysis |

---

## `ruleprobe lint-config <instruction-file>`

Parse an instruction file and emit an ESLint config. Flat config is the default; use `--format legacy` for `.eslintrc.json` output.

```bash
ruleprobe lint-config CLAUDE.md
ruleprobe lint-config CLAUDE.md --format legacy --output .eslintrc.json
ruleprobe lint-config AGENTS.md --format flat --output eslint.config.js
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `flat` | Output format: `flat` (ESLint flat config) or `legacy` (`.eslintrc.json`) |
| `--output <path>` | stdout | Write config to file |

---

## `ruleprobe drift <md-file> <eslint-file>`

Detect drift between an instruction file and an ESLint config. Reports rules present in only one side, severity mismatches, and argument differences.

```bash
ruleprobe drift CLAUDE.md .eslintrc.json
ruleprobe drift CLAUDE.md eslint.config.js --format markdown
ruleprobe drift AGENTS.md .eslintrc.json --format json --output drift-report.json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text`, `json`, or `markdown` |
| `--output <path>` | stdout | Write report to file |

---

## `ruleprobe extract <eslint-file>`

Parse an ESLint config and emit a markdown rules section suitable for pasting into an instruction file. Stylistic rules are reported but excluded from the output by default.

```bash
ruleprobe extract .eslintrc.json
ruleprobe extract eslint.config.js --output rules-section.md
```

| Option | Default | Description |
|--------|---------|-------------|
| `--output <path>` | stdout | Write output to file |
