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

**Format highlights:** `summary` outputs a compact per-category table. `detailed` shows per-rule compliance percentages with evidence. `ci` produces key=value output with GitHub Actions `::error` annotations. `rdjson` produces reviewdog-compatible JSON.

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

## `ruleprobe compare <instruction-file> <dirs...>`

Run verification against multiple agent outputs and produce a comparison.

```bash
ruleprobe compare AGENTS.md ./claude-output ./copilot-output --agents claude,copilot --format markdown
```

| Option | Default | Description |
|--------|---------|-------------|
| `--agents <names>` | none | Comma-separated labels for each directory |
| `--format <format>` | `markdown` | Report format: `text`, `json`, or `markdown` |
| `--output <path>` | stdout | Write report to file |
| `--allow-symlinks` | `false` | Follow symlinks outside the working directory |
| `--config <path>` | auto-discovered | Path to config file |

---

## `ruleprobe tasks`

List available task templates and their descriptions.

```bash
ruleprobe tasks
```

---

## `ruleprobe task <template-id>`

Output the full task prompt for a given template. Three templates ship: `rest-endpoint`, `utility-module`, `react-component`.

```bash
ruleprobe task rest-endpoint
```

---

## `ruleprobe run <instruction-file>`

Invoke an AI agent on a task template, then verify its output. Requires `@anthropic-ai/claude-agent-sdk` and `ANTHROPIC_API_KEY` for SDK mode. Alternatively, use `--watch` to point at a directory where an agent will write output.

```bash
# SDK mode: invoke Claude, verify, report
ruleprobe run CLAUDE.md --task rest-endpoint --agent claude-code --model sonnet --format text

# Watch mode: wait for output in a directory, then verify
ruleprobe run CLAUDE.md --watch ./agent-output --timeout 300 --format json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--task <template-id>` | `rest-endpoint` | Task template to give the agent |
| `--agent <name>` | `claude-code` | Agent identifier |
| `--model <name>` | `sonnet` | Model to use for the agent |
| `--format <format>` | `text` | Report format: `text`, `json`, `markdown`, or `rdjson` |
| `--output-dir <path>` | none | Directory to persist agent output |
| `--watch <dir>` | none | Watch a directory for agent output instead of invoking |
| `--timeout <seconds>` | `300` | Watch mode timeout in seconds |
| `--allow-symlinks` | `false` | Follow symlinks outside the working directory |
| `--config <path>` | auto-discovered | Path to config file |
| `--project <tsconfig>` | none | tsconfig.json path for type-aware checks |
