# RuleProbe

Verify whether AI coding agents follow the instruction files they're given.

RuleProbe parses AI coding agent instruction files (CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, GEMINI.md, .windsurfrules), extracts machine-verifiable rules, runs those rules against agent-generated code, and produces deterministic adherence reports.

## Install

```bash
npm install -g ruleprobe
```

Or use without installing:

```bash
npx ruleprobe --help
```

Requires Node.js 18+.

## Quick Start

```bash
# Parse an instruction file and see extracted rules
ruleprobe parse CLAUDE.md

# Verify agent output against an instruction file
ruleprobe verify CLAUDE.md ./agent-output --format text

# Compare multiple agents
ruleprobe compare AGENTS.md ./claude-output ./copilot-output --agents claude,copilot --format markdown

# List available task templates
ruleprobe tasks

# Get a task prompt to give an agent
ruleprobe task rest-endpoint
```

## What It Does

RuleProbe works in three stages:

1. **Parse**: reads an instruction file, identifies lines that express deterministic rules, and produces a structured rule set. Subjective instructions like "write clean code" are skipped and reported as unparseable for transparency.

2. **Verify**: takes the rule set and a directory of agent-generated files, then runs each rule against the code using AST analysis (ts-morph), file system checks, and regex pattern matching. Every rule produces a binary pass/fail with evidence (file path, line number, what was found vs. what was expected).

3. **Report**: outputs results as terminal text, JSON (for CI), or markdown (for publishing).

No LLM evaluation is used. All verification is deterministic and reproducible.

## Supported Rule Types

RuleProbe extracts and verifies these categories of rules:

| Category | Examples | Verifier |
|----------|----------|----------|
| naming | camelCase variables, PascalCase types, kebab-case files | AST, filesystem |
| forbidden-pattern | no `any` type, no console.log | AST |
| structure | named exports only, JSDoc required, max file length | AST, regex |
| test-requirement | test files exist, test naming pattern | filesystem |
| import-pattern | no path aliases, no deep relative imports | AST |

## CLI Commands

### `ruleprobe parse <instruction-file>`

Parse an instruction file and output extracted rules.

```bash
ruleprobe parse CLAUDE.md --format json
ruleprobe parse AGENTS.md --format text --show-unparseable
```

### `ruleprobe verify <instruction-file> <output-dir>`

Verify agent output against extracted rules.

```bash
ruleprobe verify CLAUDE.md ./output --agent claude-code --model opus-4 --format text
ruleprobe verify AGENTS.md ./output --format json --output report.json
ruleprobe verify AGENTS.md ./output --format markdown --severity error
```

Options:
- `--agent <name>`: agent identifier for report metadata
- `--model <name>`: model identifier for report metadata
- `--task <template-id>`: which task template was used
- `--format text|json|markdown`: output format (default: text)
- `--output <path>`: write report to file instead of stdout
- `--severity error|warning|all`: filter by severity (default: all)

### `ruleprobe compare <instruction-file> <dirs...>`

Compare verification results across multiple agent outputs.

```bash
ruleprobe compare AGENTS.md ./claude-output ./copilot-output --agents claude,copilot --format markdown
```

### `ruleprobe tasks`

List available task templates with descriptions.

### `ruleprobe task <template-id>`

Output the full task prompt for a template. Copy and paste it into your AI coding agent.

Available templates: `rest-endpoint`, `utility-module`, `react-component`.

## Programmatic API

```typescript
import {
  parseInstructionFile,
  verifyOutput,
  generateReport,
  formatReport,
} from 'ruleprobe';

const ruleSet = parseInstructionFile('CLAUDE.md');
const results = verifyOutput(ruleSet, './agent-output');
const report = generateReport(
  { agent: 'claude-code', model: 'opus-4', taskTemplateId: 'rest-endpoint',
    outputDir: './agent-output', timestamp: new Date().toISOString(), durationSeconds: null },
  ruleSet,
  results,
);
const text = formatReport(report, 'markdown');
console.log(text);
```

## GitHub Action

Run RuleProbe on every pull request. No API keys required beyond `GITHUB_TOKEN`. No LLM calls. Deterministic results. Runs in seconds.

### Minimal Setup

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
      - uses: moonrunnerkc/ruleprobe@v0.1.0
        with:
          instruction-file: AGENTS.md
          output-dir: src
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Full Input Reference

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `instruction-file` | yes | | Path to instruction file (CLAUDE.md, AGENTS.md, .cursorrules, etc) |
| `output-dir` | yes | `src` | Directory containing code to verify |
| `agent` | no | `ci` | Agent identifier for the report |
| `model` | no | `unknown` | Model identifier for the report |
| `format` | no | `text` | Report format: text, json, or markdown |
| `severity` | no | `all` | Minimum severity to report: error, warning, or all |
| `fail-on-violation` | no | `true` | Fail the action if any rule violations are found |
| `post-comment` | no | `true` | Post results as a PR comment |
| `reviewdog-format` | no | `false` | Also output in reviewdog rdjson format |

### Outputs

The action sets these outputs for downstream steps: `score`, `passed`, `failed`, `total`.

### Reviewdog Integration

```yaml
- uses: moonrunnerkc/ruleprobe@v0.1.0
  with:
    instruction-file: AGENTS.md
    output-dir: src
    reviewdog-format: "true"
    fail-on-violation: "true"
    post-comment: "true"
```

### Exit Codes

The verify command returns structured exit codes for CI consumption:

- `0`: all rules passed
- `1`: one or more rule violations found
- `2`: execution error (file not found, parse failure, etc)

## Supported Instruction Files

- CLAUDE.md
- AGENTS.md
- .cursorrules
- copilot-instructions.md
- GEMINI.md
- .windsurfrules

All formats are parsed as markdown. The parser auto-detects the file type from the filename.

## Known Limitations

- **TypeScript only.** AST verification uses ts-morph and only analyzes TypeScript and JavaScript files. Other languages are not supported.
- **No LLM evaluation.** Subjective rules ("write clean code", "follow best practices") cannot be verified. They show up in the unparseable array.
- **No automated agent invocation.** You run agents externally and point RuleProbe at the output directory. Automated invocation is planned for v0.2.0.
- **Conservative extraction.** The parser intentionally misses rules it cannot confidently interpret rather than misclassifying them. Check the unparseable array to see what was skipped.
- **No compilation required.** ts-morph parses files in isolation, which means it can analyze code that would not compile. This is by design (agent output often has errors), but it also means some type-level checks are limited.

## Security

RuleProbe never executes scanned code, never makes network calls, and never modifies files in the scanned directory. User-supplied paths are resolved and bounded to the working directory by default; symlinks outside the project are skipped unless you pass `--allow-symlinks`. All dependencies are pinned to exact versions. See [SECURITY.md](SECURITY.md) for the full security model, path traversal details, and reporting instructions.

## Case Study

See [docs/case-study-v0.1.0.md](docs/case-study-v0.1.0.md) for a demonstration comparing two agents on the rest-endpoint task template against 10 rules.

## Contributing

Issues and pull requests welcome at [github.com/moonrunnerkc/ruleprobe](https://github.com/moonrunnerkc/ruleprobe).

## License

MIT. See [LICENSE](LICENSE).
