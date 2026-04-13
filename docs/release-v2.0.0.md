# RuleProbe v2.0.0

Released: April 2026

45 files changed, +885 / -105 lines since v1.0.0. 17 new source files, 12 new test files, 572 tests across 52 test files.

## What changed

v1.0.0 could only verify naming conventions. A real-world audit against 8 repos (next.js, langchain, excalidraw, zed, elasticsearch, codex, cline, PostHog) found 98% of instruction file statements were unverifiable. v2.0.0 closes that gap with four new matcher categories, compliance scoring, multi-file analysis, structured extraction, and new report formats.

## Breaking changes

### Compliance scoring replaces binary pass/fail

`RuleResult` gains a `compliance` field (number, 0 to 1). Deterministic checks return 0 or 1. Pattern checks (prefer X over Y) return the ratio. Coverage checks (test colocation) return the percentage of source files with tests.

`DEFAULT_COMPLIANCE_THRESHOLD` is 0.8. The `--threshold` CLI option controls pass/fail determination.

```typescript
// Before (v1)
interface RuleResult {
  rule: Rule;
  passed: boolean;
  evidence: Evidence[];
}

// After (v2)
interface RuleResult {
  rule: Rule;
  passed: boolean;
  compliance: number; // 0-1, new
  evidence: Evidence[];
}
```

All existing verifiers updated. Code consuming `RuleResult` needs no changes unless it checked the shape directly, but the `compliance` field is now always present.

### Structured rule extraction

`Rule` gains two new fields:

```typescript
interface Rule {
  // ... existing fields unchanged
  section?: string;     // markdown header the rule was found under
  qualifier?: QualifierType;
}
```

`QualifierType` is a new union:

```typescript
type QualifierType =
  | 'always'        // "always use", "must", "required", or no qualifier keyword
  | 'prefer'        // "prefer", "favor", "default to", "instead of"
  | 'when-possible' // "when possible", "where feasible", "ideally"
  | 'avoid-unless'  // "avoid unless", "only when necessary", "except when"
  | 'try-to'        // "try to", "aim for", "should generally"
  | 'never'         // "never", "do not", "must not", "forbidden"
  ;
```

Detection is deterministic keyword/phrase matching during the extraction pass. No NLP, no LLM. Rules with no qualifier keyword default to `'always'`.

### Expanded category and verifier unions

```typescript
// New categories
type RuleCategory =
  | 'naming' | 'forbidden-pattern' | 'structure' | 'test-requirement'
  | 'import-pattern' | 'error-handling' | 'type-safety' | 'code-style'
  | 'dependency'
  | 'preference'      // new
  | 'file-structure'  // new
  | 'tooling'         // new
  | 'testing'         // new
  ;

// New verifier types
type VerifierType = 'ast' | 'regex' | 'filesystem' | 'treesitter'
  | 'preference'  // new
  | 'tooling'     // new
  ;
```

Exhaustive `switch` statements and `Record<RuleCategory, ...>` types need updating.

### New report format values

`ReportFormat` gains three new values: `'summary'`, `'detailed'`, `'ci'`. Existing formats (`text`, `json`, `markdown`, `rdjson`) behave identically.

## New features

### Prefer-pattern matchers (category: `preference`)

The most common instruction type across all audited repos. Extracts "prefer X over Y", "use X instead of Y", "X over Y", "favor X over Y" patterns and counts occurrences of both sides via ts-morph AST analysis.

8 prefer-pairs ship in v2.0.0:

| Pair | Preferred | Alternative |
|------|-----------|-------------|
| const-vs-let | `const` | `let` |
| named-vs-default-exports | named exports | default exports |
| interface-vs-type | `interface` | `type` alias |
| async-await-vs-then | `async`/`await` | `.then()` chains |
| arrow-vs-function-declarations | arrow functions | function declarations |
| template-literals-vs-concatenation | template literals | string concatenation |
| optional-chaining-vs-nested-conditionals | optional chaining (`?.`) | nested conditionals |
| functional-vs-class-components | functional components | class components |

Returns compliance as a ratio (e.g., 0.85 = 85% preferred usage). Adding a new pair requires only adding an entry to the `PREFER_PAIRS` array in `src/verifier/prefer-pairs.ts`. No other code changes needed.

If a pair references a pattern without a corresponding AST query, the result reports it as "detected but not yet verifiable" rather than silently dropping it.

### File/path existence matchers (category: `file-structure`)

5 matchers for instructions referencing project structure:

- **tests-dir**: "Tests go in \_\_tests\_\_/" (directory must exist and contain files)
- **components-dir**: "Components live in src/components/"
- **env-file**: "Use .env.local for local config"
- **module-index**: "Every module needs an index.ts" (checks all module directories, returns compliance ratio)
- **src-dir**: "Source code in src/"

### Dependency/tooling matchers (category: `tooling`)

9 matchers checking package.json, lockfiles, and config files:

- **Package managers**: pnpm, yarn, bun (checks lockfile presence, flags competing lockfiles)
- **Test frameworks**: vitest, jest, pytest (checks config files and package.json dependencies/scripts)
- **Tools**: eslint, prettier, biome (scans config-like files for references)

When a competing tool is detected alongside the required one (e.g., both `pnpm-lock.yaml` and `package-lock.json`), compliance is set to 0.5 and the conflict is reported.

### Test pattern matchers (category: `testing`)

3 matchers for testing conventions:

- **colocate-tests**: Checks source-to-test colocation ratio across the project
- **describe-it-blocks**: Verifies test files use `describe()`/`it()` structure
- **no-console-in-tests**: Flags `console.log/warn/error` in test files

### Multi-file project analysis

New top-level function and CLI command:

```typescript
import { analyzeProject, discoverInstructionFiles } from 'ruleprobe';

const analysis = analyzeProject('/path/to/project');
// analysis.files: per-file extraction results
// analysis.conflicts: cross-file contradictions
// analysis.redundancies: same instruction in multiple files
// analysis.coverageMap: which categories are in which files
```

`discoverInstructionFiles()` checks for all recognized instruction file names: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`. The list is a typed constant (`INSTRUCTION_FILE_NAMES`) for easy extension.

CLI: `ruleprobe analyze <project-dir> [--format text|json] [--output path]`

### Report formats

- **`--format summary`**: Compact table with per-category pass/total/score, designed as the default CLI output
- **`--format detailed`**: Full per-rule breakdown with compliance percentages, code locations, and evidence
- **`--format ci`**: Minimal key=value output with GitHub Actions `::error` annotations for failures

## New CLI options

- `--threshold <number>` on `verify`: compliance threshold (0-1) for pass/fail determination (default: 0.8)
- `ruleprobe analyze <project-dir>`: discover and analyze all instruction files in a project

## New public API exports

Functions: `analyzeProject`, `discoverInstructionFiles`

Types: `QualifierType`, `ProjectAnalysis`, `FileAnalysis`, `CrossFileConflict`, `CrossFileRedundancy`

Constants: `INSTRUCTION_FILE_NAMES`, `DEFAULT_COMPLIANCE_THRESHOLD`

## Stats

| Metric | v1.0.0 | v2.0.0 |
|--------|--------|--------|
| Source files | 75 | 92 |
| Source lines | 8,607 | 11,115 |
| Test files | 40 | 52 |
| Tests | 434 | 572 |
| Rule matchers | 53 | 78 |
| Rule categories | 9 | 13 |
| Verifier engines | 4 | 6 |
| CLI commands | 6 | 7 |

## Files created

| File | Lines | Purpose |
|------|-------|---------|
| src/parsers/qualifier-detector.ts | 104 | Deterministic qualifier detection from instruction text |
| src/parsers/rule-patterns-preference.ts | 182 | 8 preference matchers |
| src/parsers/rule-patterns-file-structure.ts | 124 | 5 file structure matchers |
| src/parsers/rule-patterns-tooling.ts | 186 | 9 tooling matchers |
| src/parsers/rule-patterns-testing.ts | 76 | 3 testing matchers |
| src/parsers/instruction-patterns.ts | 106 | Instruction candidate regex patterns (extracted from rule-extractor.ts) |
| src/verifier/prefer-pairs.ts | 132 | Prefer-pair definitions and lookup |
| src/verifier/preference-verifier.ts | 300 | AST-based preference counting |
| src/verifier/tooling-verifier.ts | 230 | Package.json/lockfile/config verification |
| src/verifier/file-structure-checks.ts | 219 | Directory/file existence and compliance checks |
| src/verifier/test-regex-checks.ts | 83 | Test file regex checks (describe/it, no-console) |
| src/analyzers/project-analyzer.ts | 239 | Multi-file discovery, conflict/redundancy detection |
| src/analyzers/index.ts | 8 | Barrel export |
| src/reporter/summary.ts | 70 | Compact summary table formatter |
| src/reporter/detailed.ts | 103 | Per-rule detailed breakdown formatter |
| src/reporter/ci.ts | 62 | CI-friendly output with GitHub Actions annotations |
| src/commands/analyze.ts | 108 | Handler for the analyze CLI command |

## Files modified

| File | Change |
|------|--------|
| src/types.ts | Added 4 categories, 2 verifier types, `QualifierType`, `compliance` on `RuleResult`, `section`/`qualifier` on `Rule`, `INSTRUCTION_FILE_NAMES`, `ProjectAnalysis` types, `DEFAULT_COMPLIANCE_THRESHOLD`, 3 new report format values |
| src/index.ts | Added exports for new types, `analyzeProject`, `discoverInstructionFiles` |
| src/parsers/rule-extractor.ts | Imports 8 matcher sources + qualifier detector; attaches `section`/`qualifier` to rules; extracted instruction patterns to separate file |
| src/verifier/index.ts | Routes `preference` and `tooling` verifier types |
| src/verifier/ast-verifier.ts | All returns include `compliance` field |
| src/verifier/regex-verifier.ts | Added `describe-it-structure` and `no-console-in-tests` cases; all returns include `compliance` |
| src/verifier/file-verifier.ts | Added `directory-exists-with-files`, `file-pattern-exists`, `module-index-required`, `test-colocation` cases; all returns include `compliance` |
| src/verifier/treesitter-verifier.ts | All returns include `compliance` |
| src/verifier/regex-checks.ts | Exported `isTestFile()` as public; moved test-specific checks to `test-regex-checks.ts` |
| src/reporter/index.ts | Routes `summary`, `detailed`, `ci` formats via exhaustive switch |
| src/reporter/text.ts | Updated `CATEGORY_ORDER` with 4 new categories |
| src/reporter/markdown.ts | Updated `CATEGORY_ORDER` with 4 new categories |
| src/cli.ts | Added `analyze` command, `--threshold` option on `verify` |

## Migration guide

1. **`compliance` field**: If your code destructures `RuleResult`, add `compliance` to the destructure. It is always present. Existing `passed` field still works and is determined by `compliance >= threshold`.

2. **New categories**: If you have exhaustive switch/Record over `RuleCategory`, add `'preference'`, `'file-structure'`, `'tooling'`, `'testing'`.

3. **New verifier types**: If you have exhaustive switch/Record over `VerifierType`, add `'preference'`, `'tooling'`.

4. **New report formats**: If you validate `ReportFormat` values, add `'summary'`, `'detailed'`, `'ci'`.

5. **`Rule` shape**: Two new optional fields (`section`, `qualifier`). No changes needed unless you validate the Rule shape strictly.

6. **`QualifierType`**: New type export. Only relevant if you consume extracted rules and want to distinguish instruction strength.
