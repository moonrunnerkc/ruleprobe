# RuleProbe v3.0.0

> **Note:** v4.0.0 consolidated the three-repo architecture into a single repo. The semantic engine now runs locally. See [docs/release-v4.0.0.md](release-v4.0.0.md) for details.

Released: April 2026

45 files changed, +3,861 / -251 lines since v2.0.0. 10 new source files, 7 new test files, 864 tests across 68 test files (was 572 across 52 at v2.0.0). 3 commits.

## What changed

v2.0.0 delivered deterministic verification with 78 matchers. The real-world gap was twofold: (1) rules like "follow existing patterns" or "maintain consistency" have no deterministic check, and (2) performance collapsed on large codebases (PostHog: 7,000+ files). v3.0.0 adds the semantic analysis tier (ASPE), fixes 12 root-cause bugs found during E2E validation, and delivers a 50% performance improvement on large repos.

## Summary of changes

### 1. Semantic analysis tier (new)

Full client-side integration for the paid ASPE (Adaptive Structural Profile Engine) tier. Eight new source files in `src/semantic/`:

- **local-extractor.ts**: single-pass tree-sitter scanner producing `RawExtractionPayload` (AST node type counts, nesting depths, opaque sub-tree hashes). No source code, variable names, comments, file paths, or imports leave the machine.
- **client.ts**: HTTP client sending raw vectors to the API service, receiving `SemanticVerdict[]` back. Handles license validation, graceful degradation on network failure, timeout, and retry.
- **config.ts**: license key resolution (CLI flag > env var `RULEPROBE_LICENSE_KEY` > `.ruleprobe/config.json`), API endpoint configuration.
- **types.ts**: public contract types (`StructuralProfile`, `FeatureVector`, `CrossFileGraph`, `SemanticVerdict`, `RawExtractionPayload`, etc.).
- **ast-visitor.ts**: recursive tree visitor, canonical shape hashing (SHA-256 of AST structure), deviation comment detection, node classification.
- **file-walker.ts**: file discovery respecting `.gitignore`, `node_modules`, `dist`, `build`, `.next` exclusions, sorted for deterministic order.
- **audit-log.ts**: timestamped logging of every API call to `.ruleprobe/semantic-log/`.
- **index.ts**: orchestrator wiring local extraction, remote analysis, and result integration.

**Privacy guarantee:** only numeric vectors, opaque hashes, boolean flags, and rule text are transmitted. Verified by automated privacy test against excalidraw (626 files) and PostHog (7,160 files). See [verification/e2e-verification-report.md](verification/e2e-verification-report.md) section 5.

### 2. CLI semantic flags (new)

Six new flags on the `analyze` command:

| Flag | Description |
|------|-------------|
| `--semantic` | Enable semantic analysis (requires license key) |
| `--license-key <key>` | License key for the semantic tier |
| `--max-llm-calls <n>` | Cap LLM calls per analysis (default: 20) |
| `--no-cache` | Disable profile caching |
| `--semantic-log` | Print what was sent/received to stdout |
| `--cost-report` | Show token cost breakdown |

Without `--semantic`, the analyze command runs deterministic analysis only (unchanged behavior). If the license key is invalid or the API is unreachable, semantic analysis is skipped gracefully and deterministic results are still returned.

### 3. Batch AST verifier (performance fix)

**Problem:** v2.0.0 parsed every file once per AST rule, yielding O(rules * files) ts-morph parse calls. On PostHog (7,000+ files, ~30 AST rules), this was prohibitively slow.

**Fix:** new `ast-verifier-batch.ts` creates one ts-morph Project, parses each file once, runs every non-type-aware rule against it, then discards the SourceFile. Complexity drops to O(files).

The verifier router (`src/verifier/index.ts`) now collects all AST rules, runs them through the batch verifier in a single pass, then routes remaining rule types individually.

### 4. Tree-sitter WASM stability fix

**Problem:** creating a new `Parser` and calling `Language.load()` for every file caused WASM function table exhaustion on large repos (PostHog: 7,000+ Python files). Parser objects were leaked because `parser.delete()` was called inconsistently.

**Fix:** `treesitter-loader.ts` now caches one `Parser` instance per language. `Language.load()` is called once per grammar. The `parseWithTreeSitter()` return type no longer includes the parser (callers must not delete shared parsers). Tree deletion remains the caller's responsibility.

### 5. UPPER_CASE constant naming check (new matcher)

New AST check in `src/ast-checks/naming.ts`: verifies that module-scope `const` declarations with primitive initializers use `UPPER_CASE` naming. Skips destructured bindings, function expressions, arrow functions, objects, and arrays.

### 6. Analyze command decomposition

`src/commands/analyze.ts` was refactored: formatter functions extracted to `src/commands/analyze-formatters.ts` (289 lines) to comply with the 300-line file limit. The analyze handler now supports semantic integration, JSON/markdown output for analyze results, and the `--threshold` flag for CI pass/fail determination.

### 7. Matcher broadening

Existing matcher files received targeted additions:

- **rule-patterns.ts**: +19 lines, broader keyword matching for existing patterns
- **rule-patterns-extended.ts**: +50 lines, additional recognition patterns
- **rule-patterns-preference.ts**: +4 lines, regex fix for preference pair detection

### 8. Calibration data

Real-world calibration fixtures added from excalidraw (626 files) and PostHog (7,160 files):

| Metric | excalidraw | PostHog |
|--------|-----------|---------|
| Files extracted | 626 | 7,160 |
| Extraction time | 7.5s | 38.6s |
| Unique AST node types | 278 | 298 |
| Sub-tree hashes | 9,262 | 119,254 |
| Topic-matched rules | 24/39 | 45/68 |
| Mean similarity (matched) | 0.9833 | 0.9834 |

**Calibrated threshold:** 0.85 (pre-calibration default confirmed; all topic-matched rules scored above 0.95 in both repos).

**Calibrated weights:** Jaccard=0.4, Cosine=0.6 (confirmed; near-identical means across repos of vastly different sizes validates scale-independence).

Full calibration report: `tests/fixtures/calibration/CALIBRATION-REPORT.md`

## Bug fixes (12 root-cause resolutions)

All found during E2E verification against excalidraw and PostHog. Each is a root-cause fix, not a workaround.

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | Tree-sitter WASM crash on large repos | New Parser per file exhausts WASM function table | Cache one Parser per language in `treesitter-loader.ts` |
| 2 | O(rules*files) AST performance | Each rule triggered a full ts-morph parse of every file | Batch AST verifier: parse each file once |
| 3 | Matchers not wired to runner | Some v2.0.0 matchers never ran during verification | Connected all matchers through verifier routing |
| 4 | Missing markdown/json analyze output | `analyze` only output text format | Added format routing for analyze command |
| 5 | Narrow matcher regexes | Some rule patterns not triggering on real instruction text | Broadened keyword matching in 3 pattern files |
| 6 | Enum string comparison mismatch | `VariableDeclarationKind` compared as wrong type | Import and use `VariableDeclarationKind` enum directly |
| 7 | analyze.ts exceeds 300-line limit | Formatters inline in handler | Extract to `analyze-formatters.ts` |
| 8 | Stale `parser.delete()` in tests | Tests calling delete on shared parser | Remove stale cleanup calls |
| 9 | Client/API header mismatch | `client.ts` sent license key in body, API expected `x-license-key` header | Added header to fetch call |
| 10 | AnalyzeResponse shape mismatch | Client expected `{verdicts, report}`, API returns `{report}` with `report.verdicts` nested | Fixed type and read path |
| 11 | JSON format corruption | Semantic summary text appended after `JSON.stringify` output | Guard semantic summary for non-JSON formats |
| 12 | Test mock shape mismatch | Mocks had verdicts at top level, code reads `report.verdicts` | Fixed mocks to nest verdicts inside report |

## Breaking changes

### New verifier return type for tree-sitter

`parseWithTreeSitter()` no longer returns a `parser` in its result object. Callers that previously called `parser.delete()` must remove that call. The parser is now shared and cached internally.

```typescript
// Before (v2.0.0)
const result = await parseWithTreeSitter(path, lang);
// result: { root, tree, parser }
result.parser.delete();

// After (v3.0.0)
const result = await parseWithTreeSitter(path, lang);
// result: { root, tree }
// parser is cached internally, do NOT delete
```

### Analyze handler is now async

`src/commands/analyze.ts` handler changed from sync to async to support the semantic pipeline. If you call `handleAnalyze()` programmatically, `await` the result.

## New CLI options

- `--semantic` on `analyze`: enable semantic analysis
- `--license-key <key>` on `analyze`: license key
- `--max-llm-calls <n>` on `analyze`: cap LLM calls (default: 20)
- `--no-cache` on `analyze`: disable profile caching
- `--semantic-log` on `analyze`: print API call log
- `--cost-report` on `analyze`: show token cost breakdown
- `--threshold <number>` on `analyze`: compliance threshold for CI pass/fail (default: 0.8)

## New public types

All new types are in `src/semantic/types.ts`:

- `PatternTopic`
- `StructuralProfile`
- `FeatureVector`
- `CrossFileGraph`
- `SemanticVerdict`
- `StructuralViolation`
- `SemanticAnalysisConfig`
- `QualifierType` (re-exported from core types)
- `QualifierContext`
- `SemanticAnalysisReport`
- `CrossFileFinding`
- `RawExtractionPayload`
- `RawFileVector`
- `ExtractedRulePayload`

Note: the semantic module is not re-exported from `src/index.ts`. Import directly from `ruleprobe/dist/semantic/index.js` if needed programmatically.

## Files created

| File | Lines | Purpose |
|------|------:|---------|
| src/semantic/types.ts | 155 | Public contract types for semantic tier |
| src/semantic/local-extractor.ts | 261 | Single-pass tree-sitter AST extraction |
| src/semantic/client.ts | 164 | HTTP client for API service |
| src/semantic/config.ts | 120 | License key and endpoint resolution |
| src/semantic/index.ts | 156 | Semantic pipeline orchestrator |
| src/semantic/ast-visitor.ts | 152 | Recursive tree visitor and shape hashing |
| src/semantic/file-walker.ts | 137 | File discovery with exclusion patterns |
| src/semantic/audit-log.ts | 96 | Local API call audit logging |
| src/verifier/ast-verifier-batch.ts | 100 | Batch AST verifier (O(files) performance) |
| src/commands/analyze-formatters.ts | 289 | Extracted analyze output formatters |
| **Total new source** | **1,630** | |

| Test File | Lines | Purpose |
|-----------|------:|---------|
| tests/semantic/local-extractor.test.ts | 186 | Tree-sitter extraction, opaque IDs, privacy |
| tests/semantic/index.test.ts | 245 | Pipeline orchestration, graceful degradation |
| tests/semantic/client.test.ts | 207 | HTTP client, retry, license validation |
| tests/semantic/config.test.ts | 159 | Config resolution priority |
| tests/semantic/audit-log.test.ts | 148 | Audit log file creation and format |
| tests/semantic/not-verifiable.test.ts | 99 | Not-verifiable verdict handling |
| tests/cli/semantic-flags.test.ts | 94 | CLI flag parsing and wiring |
| **Total new tests** | **1,138** | |

| Fixture/Data | Purpose |
|-------------|---------|
| tests/fixtures/calibration/CALIBRATION-REPORT.md | Measured threshold and weight calibration |
| tests/fixtures/calibration/payloads/excalidraw-calibration.json | Excalidraw extraction payload |
| tests/fixtures/calibration/payloads/excalidraw-weights.json | Excalidraw weight sweep data |
| tests/fixtures/calibration/payloads/posthog-calibration.json | PostHog extraction payload |
| tests/fixtures/calibration/payloads/posthog-weights.json | PostHog weight sweep data |
| tests/semantic/fixtures/sample-project/ | Minimal fixture for unit tests |
| docs/verification/e2e-verification-report.md | Full E2E verification evidence |

## Files modified

| File | Change | +/- |
|------|--------|-----|
| src/cli.ts | Added 6 semantic flags and `--threshold` on analyze; handler now async | +20/-3 |
| src/verifier/index.ts | Batch AST routing; single-pass architecture | +24/-11 |
| src/commands/analyze.ts | Semantic integration; format routing; extracted formatters | +115/-67 |
| src/ast-checks/naming.ts | Added `checkUpperCaseConstants` function | +55/-1 |
| src/ast-checks/index.ts | Re-export `checkUpperCaseConstants` | +1/-1 |
| src/verifier/treesitter-loader.ts | Parser caching; Language.load caching; removed parser from return | +26/-10 |
| src/verifier/ast-verifier.ts | Simplified to work with batch verifier | +15/-23 |
| src/verifier/tooling-verifier.ts | Additional tooling check patterns | +34/-0 |
| src/verifier/preference-verifier.ts | Minor regex improvement | +3/-0 |
| src/verifier/treesitter-verifier.ts | Removed stale parser.delete() call | +0/-1 |
| src/parsers/rule-patterns-extended.ts | Broader keyword matching | +50/-0 |
| src/parsers/rule-patterns.ts | Additional pattern recognition | +19/-0 |
| src/parsers/rule-patterns-preference.ts | Regex fix for pair detection | +4/-1 |
| package.json | Added tree-sitter-typescript, tree-sitter-javascript dependencies | (dep change) |
| vitest.config.ts | Added semantic test path | +1/-0 |
| .gitignore | Added .ruleprobe/ and calibration artifacts | (config) |
| tests/verifier/treesitter.test.ts | Removed stale parser.delete() calls | +0/-9 |
| README.md | Full rewrite with accurate counts and semantic tier docs | (doc) |

## Stats

| Metric | v2.0.0 | v3.0.0 | Delta |
|--------|--------|--------|-------|
| Source files | 95 | 105 | +10 |
| Source lines | 11,288 | 16,872 | +5,584 |
| Test files (.test.ts) | 52 | 59 | +7 |
| Test lines | 7,215 | 9,988 | +2,773 |
| Tests passing | 572 | 864 | +292 |
| Rule matchers | 78 | 102 | +24 |
| Rule categories | 13 | 14 | +1 |
| Verifier engines | 6 | 8 | +2 |
| Instruction file formats | 6 | 7 | +1 |
| Tree-sitter languages | 2 | 4 | +2 |

Note: the 102 matchers and 14 categories include changes made between v1.0.0 and the v2.0.0 tag that were not reflected in the v2.0.0 release notes. The v2.0.0 release doc reported 78 matchers / 13 categories, but the actual v2.0.0 codebase at the git tag already contained `config-file` and `git-history` matchers (15 + 5 = 20 additional matchers in the `workflow` category, plus count increases in other categories). The v3.0.0 stats are measured from the actual v2.0.0 git tag, not the v2.0.0 release doc numbers.

## Three-repo ecosystem status

v3.0.0 is the first release where all three repos are operational end-to-end:

| Repo | Tests | Status | Role |
|------|-------|--------|------|
| ruleprobe (public) | 864 | All passing | CLI, deterministic engine, semantic client |
| ruleprobe-semantic (private) | 221 | All passing | ASPE algorithms, fingerprinting, LLM prompts |
| ruleprobe-api-service (private) | 54 | All passing | HTTP service, license management, SQLite storage |
| **Total** | **1,139** | **All passing** | |

E2E validated against excalidraw (626 files, 9 rules, 100% fast-path) and PostHog (7,160 files, 4 rules, 100% fast-path). Full evidence in [verification/e2e-verification-report.md](verification/e2e-verification-report.md).

## Migration guide

1. **`parseWithTreeSitter()` return type**: if you destructured `{ root, tree, parser }`, remove `parser`. Do not call `parser.delete()`. Trees still need `tree.delete()`.

2. **`handleAnalyze()` is now async**: if you call it directly (not through the CLI), add `await`.

3. **New dependencies**: `tree-sitter-typescript` and `tree-sitter-javascript` are now dependencies (previously only `tree-sitter-python` and `tree-sitter-go`). Run `npm install` to pick them up.

4. **Semantic tier is opt-in**: no changes needed for existing deterministic workflows. Pass `--semantic --license-key <key>` to enable.

5. **New ignore patterns**: `.ruleprobe/` is now in `.gitignore` (audit logs, cache). Add it to your project's `.gitignore` if you use `--semantic`.
