# RuleProbe: Build Guide

## Problem Statement

AI coding agents read instruction files (CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, GEMINI.md, .windsurfrules) before generating code. Over 60,000 repositories on GitHub already include an AGENTS.md (https://vibecoding.app/blog/agents-md-guide). A Princeton study across 124 merged PRs showed AGENTS.md reduced runtime by 28.6% and token usage by 16.6% (https://www.morphllm.com/agents-md-guide). Anthropic admits they manually tune CLAUDE.md instructions with emphasis markers like "IMPORTANT" and "YOU MUST" to improve adherence (https://gist.github.com/0xdevalias/f40bc5a6f84c4c5ad862e314894b2fa6).

No tool verifies whether agents actually follow these rules. Every existing benchmark measures coding ability (SWE-Bench), model capability (Aider Polyglot), or output quality (DeepEval). None measures instruction adherence. The comprehensive 2026 benchmark roundup at https://www.morphllm.com/ai-coding-benchmarks-2026 covers SWE-Bench Verified, SWE-Bench Pro, Terminal-Bench, Aider Polyglot, LiveCodeBench, and HumanEval. Instruction adherence is absent from all of them.

Research shows agents hit 90% success with explicit identifiers but drop to 40% with natural language descriptions (https://a-listware.com/blog/open-source-ai-agents-news). Instruction files are entirely natural language.

RuleProbe fills this gap: parse instruction files, extract testable rules, give agents standardized tasks, and deterministically verify whether the output complied.

## Constraints

- Solo developer, must ship v0.1.0 within 2 weeks
- No LLM-as-judge; all verification is deterministic (AST, regex, file system checks)
- Agent-agnostic: works with any agent that accepts a task prompt and produces file output
- Must produce a publishable case study on first run
- TypeScript, published to npm, runs as CLI

## Architecture

### Core Pipeline

```
Instruction File --> Rule Parser --> Rule Set (structured)
                                         |
                                         v
Task Template --> Agent Runner --> Agent Output (files on disk)
                                         |
                                         v
                              Rule Verifier --> Adherence Report
```

Three stages, strictly separated:

**Stage 1: Rule Extraction.** Parse an instruction file and extract machine-verifiable rules. Not every line in a CLAUDE.md is testable. "Use clear variable names" is subjective. "Use camelCase for variables" is deterministic. The parser identifies rules that can be verified without an LLM.

**Stage 2: Agent Execution.** Give a standardized coding task to an agent and capture the output files. RuleProbe does not call agent APIs directly. It provides a task prompt, the agent runs externally (Claude Code in terminal, Copilot in VS Code, Cursor in its IDE), and the user points RuleProbe at the output directory. This keeps the system agent-agnostic and avoids API coupling.

Future versions can add direct agent invocation via subprocess (claude -p for Claude Code, codex for Codex CLI) for automated benchmarking.

**Stage 3: Verification.** Run deterministic checks against each extracted rule. AST parsing for structural rules (naming, patterns, imports). Regex for formatting rules (indentation, line length). File system checks for organizational rules (directory structure, file naming). Test runner invocation for coverage rules. Each rule produces a binary pass/fail with evidence (the specific line or pattern that violated).

### What Each Component Does

**Rule Parser** reads instruction files and produces a structured RuleSet. It handles CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md, and GEMINI.md. All are markdown. The parser extracts rules by identifying imperative statements with deterministic criteria. It categorizes each rule by type (naming, structure, forbidden-pattern, test-requirement, file-organization) and generates a verification function signature for each.

**Task Templates** are standardized coding tasks designed to exercise common rule categories. A task template specifies: the prompt given to the agent, the expected output structure (files, directories), and which rule categories it exercises. v0.1.0 ships with 3 task templates: a REST API endpoint (exercises naming, structure, error handling), a utility module with tests (exercises test coverage, import patterns), and a React component (exercises file organization, naming conventions).

**Agent Runner** is a thin wrapper that records metadata: which agent was used, which model, timestamp, and task template ID. In v0.1.0 it simply validates that output files exist at the specified path. Later versions add subprocess invocation for automated runs.

**Rule Verifier** takes a RuleSet and an output directory, runs each rule's verification function, and produces a structured report. Verification functions are deterministic. They use TypeScript AST parsing (via ts-morph) for code structure rules and standard file system operations for organizational rules.

**Report Generator** produces output in three formats: plain text for terminal, JSON for CI integration, and markdown for publishing.

## File Structure

```
ruleprobe/
  package.json
  tsconfig.json
  LICENSE                         # MIT
  README.md
  src/
    index.ts                      # CLI entry point
    cli.ts                        # Command definitions (commander)
    types.ts                      # All shared types
    parsers/
      index.ts                    # Parser router (detects file type)
      rule-extractor.ts           # Core extraction logic
      markdown-parser.ts          # Parses markdown instruction files
    rules/
      index.ts                    # Rule registry
      rule-types.ts               # Rule category definitions
      matchers/
        naming.ts                 # camelCase, kebab-case, PascalCase checks
        forbidden-pattern.ts      # "never use any", "no console.log", etc
        structure.ts              # file organization, directory layout
        test-coverage.ts          # test file existence, assertion patterns
        import-pattern.ts         # import style, barrel files, path aliases
    verifier/
      index.ts                    # Orchestrates verification
      ast-verifier.ts             # TypeScript/JavaScript AST checks
      file-verifier.ts            # File system structure checks
      regex-verifier.ts           # Pattern matching checks
    runner/
      index.ts                    # Agent run metadata capture
      task-templates/
        rest-endpoint.md          # Task: build a REST endpoint
        utility-module.md         # Task: build a utility with tests
        react-component.md        # Task: build a React component
    reporter/
      index.ts                    # Report generation router
      text.ts                     # Terminal output
      json.ts                     # Machine-readable output
      markdown.ts                 # Publishable report
  tests/
    parsers/
      rule-extractor.test.ts
      markdown-parser.test.ts
    rules/
      naming.test.ts
      forbidden-pattern.test.ts
      structure.test.ts
    verifier/
      ast-verifier.test.ts
      file-verifier.test.ts
    fixtures/
      sample-claude-md/           # Example CLAUDE.md files
      sample-agents-md/           # Example AGENTS.md files
      sample-output/              # Mock agent outputs (passing and failing)
```

## Types (src/types.ts)

```
Rule
  id: string                      # unique, e.g. "naming-camelcase-variables"
  category: RuleCategory          # naming | forbidden-pattern | structure | test-requirement | import-pattern
  source: string                  # raw text from instruction file
  description: string             # human-readable summary
  severity: "error" | "warning"
  verifier: VerifierType          # ast | regex | filesystem
  pattern: VerificationPattern    # the specific check to run

RuleCategory
  "naming" | "forbidden-pattern" | "structure" | "test-requirement" | "import-pattern"

VerifierType
  "ast" | "regex" | "filesystem"

VerificationPattern
  type: string                    # e.g. "camelCase", "no-any", "file-exists"
  target: string                  # what to check (e.g. "variables", "*.ts", "src/")
  expected: string | RegExp | boolean
  scope: "file" | "project"

RuleSet
  source_file: string            # path to instruction file
  source_type: InstructionFileType
  rules: Rule[]
  unparseable: string[]          # lines that couldn't be converted to rules (for transparency)

InstructionFileType
  "claude.md" | "agents.md" | "cursorrules" | "copilot-instructions" | "gemini.md" | "windsurfrules" | "unknown"

TaskTemplate
  id: string
  name: string
  prompt: string                  # the full prompt given to the agent
  expected_files: string[]        # files the output should contain
  exercises: RuleCategory[]       # which rule categories this task tests

AgentRun
  agent: string                   # "claude-code" | "copilot" | "cursor" | "codex" | "other"
  model: string                   # "opus-4.6" | "gpt-5.4" | etc
  task_template_id: string
  output_dir: string
  timestamp: string               # ISO 8601
  duration_seconds: number | null

RuleResult
  rule: Rule
  passed: boolean
  evidence: Evidence[]            # what was checked, what was found

Evidence
  file: string
  line: number | null
  found: string                   # what was actually in the code
  expected: string                # what the rule required
  context: string                 # surrounding code for readability

AdherenceReport
  run: AgentRun
  ruleset: RuleSet
  results: RuleResult[]
  summary: ReportSummary

ReportSummary
  total_rules: number
  passed: number
  failed: number
  warnings: number
  adherence_score: number         # passed / total_rules as percentage
  by_category: Record<RuleCategory, { passed: number, total: number }>
```

## CLI API

```
ruleprobe parse <instruction-file>
  Parses an instruction file and outputs extracted rules as JSON.
  Flags:
    --format json|text             # output format, default text
    --show-unparseable             # include lines that couldn't be extracted

ruleprobe verify <instruction-file> <output-dir>
  Parses rules from instruction file, verifies agent output against them.
  Flags:
    --agent <name>                 # agent identifier for report metadata
    --model <name>                 # model identifier for report metadata
    --task <template-id>           # which task template was used
    --format text|json|markdown    # report format, default text
    --output <path>                # write report to file instead of stdout
    --severity error|warning|all   # filter results by severity

ruleprobe tasks
  Lists available task templates with descriptions.

ruleprobe task <template-id>
  Outputs the full task prompt for a given template (copy-paste into agent).

ruleprobe compare <instruction-file> <dir1> <dir2> [dir3...]
  Runs verification against multiple agent outputs and produces a comparison table.
  Flags:
    --agents <name1,name2,...>     # labels for each directory
    --format text|json|markdown
    --output <path>
```

## Programmatic API (src/index.ts exports)

```
parseInstructionFile(filePath: string): RuleSet
  Reads and parses any supported instruction file format.

extractRules(markdown: string, fileType: InstructionFileType): Rule[]
  Extracts rules from raw markdown content.

verifyOutput(ruleSet: RuleSet, outputDir: string): RuleResult[]
  Runs all rules against files in the output directory.

generateReport(run: AgentRun, ruleSet: RuleSet, results: RuleResult[]): AdherenceReport
  Assembles a complete adherence report.

formatReport(report: AdherenceReport, format: "text" | "json" | "markdown"): string
  Renders the report in the specified format.
```

## Rule Extraction Strategy

Not every instruction is machine-verifiable. The parser uses pattern matching to identify rules that have deterministic criteria.

**Extractable (deterministic):**
- "Use camelCase for variables" --> naming check via AST
- "Never use any type" --> forbidden pattern via AST (ts-morph: check for any type annotations)
- "All files must have tests" --> file system check (for each src/*.ts, check tests/*.test.ts exists)
- "Use named exports only" --> AST check for export default
- "No console.log in production code" --> regex or AST check
- "Use kebab-case for file names" --> file system regex check
- "Maximum file length 300 lines" --> line count check
- "Imports must use path aliases (@/)" --> AST import path check
- "Every function must have JSDoc" --> AST check for leading comments
- "No relative imports deeper than 2 levels" --> regex on import paths

**Not extractable (subjective, skipped with transparency):**
- "Write clean code"
- "Use clear variable names"
- "Follow best practices"
- "Keep it simple"

The parser reports skipped lines in the unparseable array so users see what wasn't tested.

## Verification Functions

### AST Verifier (ts-morph)

Handles: naming conventions, forbidden patterns, import patterns, export patterns, JSDoc requirements, type annotation checks.

Process: load each .ts/.tsx/.js/.jsx file in the output directory into a ts-morph Project. Walk the AST and check each rule. Collect violations with file, line number, found value, and expected value.

Naming checks use ts-morph's getVariableDeclarations(), getFunctions(), getClasses(), getInterfaces() and validate identifier format against the rule's expected pattern (camelCase, PascalCase, kebab-case, UPPER_SNAKE_CASE).

Forbidden pattern checks use getDescendantsOfKind() to find specific node types. For "no any type": find TypeReferenceNodes and KeywordTypeNodes matching SyntaxKind.AnyKeyword. For "no console.log": find CallExpressions where the expression text matches console.log.

### File Verifier

Handles: file naming conventions, directory structure, test file co-location, file count limits, file length limits.

Process: recursively walk the output directory, collect file paths relative to root, and run checks. File naming uses regex against the basename. Directory structure checks verify expected directories exist. Test co-location checks map source files to expected test file locations.

### Regex Verifier

Handles: indentation style, line length, trailing whitespace, specific string patterns in file contents.

Process: read file contents as text, run regex patterns line by line, collect violations with line numbers.

## Dependencies

```
Production:
  commander           # CLI framework
  ts-morph             # TypeScript AST parsing (built on TypeScript compiler API)
  glob                 # File pattern matching
  chalk                # Terminal colors

Development:
  vitest               # Test runner
  typescript           # Compiler
  @types/node
```

ts-morph is the critical dependency. It provides full TypeScript AST access without requiring the user's project to compile. It can parse TypeScript files in isolation, which is necessary because agent output may have errors.

## Implementation Sequence

### Phase 1: Core Parser (days 1-3)

Build the markdown parser and rule extractor. This is the hardest component because instruction files are freeform natural language. The parser needs to handle varied phrasings:

- "Use camelCase for all variable names"
- "Variables should be camelCase"
- "camelCase variables only"
- "Never use snake_case for variables"

Strategy: maintain a dictionary of known rule patterns (camelCase, PascalCase, kebab-case, no-any, no-console-log, named-exports, etc) and match instruction file lines against them using keyword extraction. This is deliberately conservative. Miss a rule rather than misinterpret one. The unparseable array catches misses transparently.

Milestone: ruleprobe parse CLAUDE.md outputs a structured rule set with correct categorization.

### Phase 2: Verifiers (days 4-7)

Build AST, file system, and regex verifiers. Start with the AST verifier since it covers the most rule types.

Test against fixtures: create sample agent outputs that deliberately violate specific rules and verify the verifier catches them. Create passing outputs and verify clean reports.

Milestone: ruleprobe verify CLAUDE.md ./sample-output produces correct pass/fail results for all fixture scenarios.

### Phase 3: CLI and Reports (days 8-10)

Wire up the CLI with commander. Build the three report formatters. Add the compare command for multi-agent comparison.

Milestone: full CLI works end-to-end. ruleprobe compare produces a readable comparison table.

### Phase 4: Task Templates and Case Study (days 11-14)

Write the three task templates. Run them through Claude Code, Copilot, and Cursor with a standardized AGENTS.md containing 10 testable rules. Capture outputs. Run ruleprobe verify against each. Publish results as the launch case study.

Milestone: published case study with adherence scores across 3 agents.

## Task Template Design (Example: REST Endpoint)

The task prompt is designed to exercise multiple rule categories simultaneously:

```
Build a REST API endpoint for managing user bookmarks.

Requirements:
- POST /bookmarks - create a bookmark (url, title, tags)
- GET /bookmarks - list bookmarks with optional tag filter
- DELETE /bookmarks/:id - remove a bookmark

Technical:
- TypeScript, Express
- Input validation on all endpoints
- Error handling with proper HTTP status codes
- Unit tests for all endpoints
- Export types for request/response shapes
```

This exercises: naming conventions (variables, files, functions), forbidden patterns (any types, console.log), structure (test files exist, proper exports), import patterns (path aliases, named exports).

The prompt deliberately does not mention the instruction file rules. The agent should follow them from the loaded instruction file, not from the task prompt.

## Report Format (Text Output Example)

```
RuleProbe Adherence Report
Agent: claude-code | Model: opus-4.6 | Task: rest-endpoint
Date: 2026-04-06T14:30:00Z

Rules: 10 total | 7 passed | 3 failed | Score: 70%

PASS  naming/camelcase-variables
PASS  naming/kebab-case-files
FAIL  forbidden/no-any-type
      src/routes/bookmarks.ts:24 - found: req: any
      src/routes/bookmarks.ts:31 - found: res: any
PASS  forbidden/no-console-log
FAIL  structure/test-files-exist
      missing: tests/routes/bookmarks.test.ts
PASS  structure/named-exports-only
PASS  import/path-aliases
PASS  import/no-deep-relative
FAIL  test/minimum-assertions
      tests/bookmarks.test.ts has 2 assertions, minimum required: 5
PASS  formatting/max-line-length

By Category:
  naming:           2/2 (100%)
  forbidden:        1/2 (50%)
  structure:        1/2 (50%)
  import:           2/2 (100%)
  test:             0/1 (0%)
  formatting:       1/1 (100%)
```

## Comparison Report Format (Markdown Output)

```
# RuleProbe: Agent Instruction Adherence Comparison

Rules source: AGENTS.md (10 rules extracted, 2 unparseable)
Task: rest-endpoint
Date: 2026-04-06

| Rule | Claude Code | Copilot | Cursor |
|------|:-----------:|:-------:|:------:|
| camelCase variables | PASS | PASS | PASS |
| kebab-case files | PASS | FAIL | PASS |
| no any type | FAIL | FAIL | PASS |
| no console.log | PASS | PASS | PASS |
| test files exist | FAIL | FAIL | FAIL |
| named exports | PASS | PASS | FAIL |
| path aliases | PASS | FAIL | PASS |
| no deep relative | PASS | PASS | PASS |
| min assertions | FAIL | FAIL | FAIL |
| max line length | PASS | PASS | PASS |

| Agent | Score |
|-------|-------|
| Claude Code (opus-4.6) | 70% |
| Copilot (gpt-5.4) | 60% |
| Cursor (sonnet-4.6) | 70% |
```

## Growth Path (Post v0.1.0)

v0.2.0: Direct agent invocation via subprocess. claude -p for Claude Code, codex for Codex CLI. Enables fully automated benchmark runs.

v0.3.0: Rule extraction from .cursorrules MDC format (YAML frontmatter + markdown). Support for scoped rules (frontend.mdc only checks frontend files).

v0.4.0: GitHub Action. Run ruleprobe verify on every PR to catch instruction drift. Output as PR comment.

v0.5.0: Historical tracking. Store results in a local SQLite DB. Show adherence trends over time, across model versions.

v1.0.0: Community rule packs. Shareable, curated rule sets for common stacks (Next.js, FastAPI, Go stdlib). Users contribute verified rules.

Each version adds value independently. No version requires rewriting prior work. The architecture supports all of these without structural changes.

## Risks

**Rule extraction accuracy.** Freeform markdown is hard to parse reliably. Mitigation: be conservative, surface unparseable lines, let users manually add rules via a .ruleprobe.json override file. Start with a small set of known patterns and expand based on real-world instruction files.

**Agent output variability.** Agents produce different file structures each run. Mitigation: task templates specify expected file paths. The verifier scans recursively and matches by pattern, not exact path.

**Funded player risk.** Anthropic, GitHub, or OpenAI could build internal compliance testing. Mitigation: they're structurally disincentivized from publishing embarrassing results about their own products. Independent testing is protected by the same dynamic that keeps Consumer Reports independent from automakers.

**Scope creep.** Temptation to add LLM-as-judge for subjective rules. Mitigation: deterministic only. If it can't be verified without an LLM, it goes in unparseable. This is a feature, not a limitation. Deterministic verification is reproducible. LLM-as-judge is not.
