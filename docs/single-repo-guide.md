# Single-Repo Consolidation Guide

Merge `ruleprobe-semantic` and `ruleprobe-api-service` into the main `ruleprobe` repo. Remove the paid tier, license keys, and API service. Semantic analysis runs locally with the user's own `ANTHROPIC_API_KEY`.

## Current state (3 repos)

| Repo | Visibility | Source files | Source lines | Test files | Test lines |
|------|-----------|-------------:|------------:|-----------:|-----------:|
| ruleprobe | public | ~105 | ~16,800 | ~59 | ~9,900 |
| ruleprobe-semantic | private | 40 | ~3,600 | 18 | ~3,100 |
| ruleprobe-api-service | private | 11 | ~925 | 9 | ~980 |

**Data flow today:**
1. CLI runs `local-extractor.ts` (tree-sitter scan, produces `RawExtractionPayload`)
2. `client.ts` sends payload over HTTP to the API service
3. API service imports `analyzeSemantic()` from `ruleprobe-semantic`, runs it server-side
4. API service returns `SemanticVerdict[]` to the CLI
5. CLI integrates verdicts into `ProjectAnalysis`

**Data flow after consolidation:**
1. CLI runs `local-extractor.ts` (unchanged)
2. CLI calls `analyzeSemantic()` directly (no HTTP, no server)
3. `analyzeSemantic()` uses the user's `ANTHROPIC_API_KEY` for any LLM calls
4. CLI integrates verdicts into `ProjectAnalysis` (unchanged)

---

## Coding standards

All code in this migration must follow the rules in `.github/copilot-instructions.md` (lines 128-142):

- Named exports only, no default exports
- kebab-case filenames
- No `any` types anywhere
- Full JSDoc on all public functions
- 300-line file limit; decompose if exceeded
- Tests validate real behavior, not wiring
- No mocks for things that can be tested directly (exception: Anthropic API boundary)
- Error messages include what failed and what to do about it
- DRY: extract at 3 repetitions, not before
- Test names describe the behavior, not the implementation
- No em dashes anywhere (code, comments, docs, strings)
- No magic numbers; every threshold, weight, and cutoff is a named constant with JSDoc
- No `default` in any import/export statement

---

## Phase 1: Copy semantic engine into ruleprobe

### Step 1.1: Create the target directory structure

Create `src/semantic/engine/` in the ruleprobe repo. This is where all `ruleprobe-semantic` source files will live.

```
src/semantic/engine/
  index.ts                              # re-export of analyzeSemantic()
  types.ts                              # DELETE (use existing src/semantic/types.ts)
  rule-resolver.ts
  llm-escalation.ts
  fingerprint/
    base-topics.ts
    composite-patterns.ts
    example-harvester.ts
    expanded-topics.ts
    fingerprint-cache.ts
    fingerprint-generator.ts
    hash-utils.ts
    runtime-topic-extension.ts
    topic-registry.ts
    structural-features/
      api-patterns.ts
      code-style.ts
      component-structure.ts
      data-fetching.ts
      error-handling.ts
      file-organization.ts
      file-structure-semantic.ts
      index.ts
      language-requirements.ts
      logging.ts
      naming-conventions.ts
      shared.ts
      state-management.ts
      testing-patterns.ts
      tooling.ts
      validation.ts
      workflow.ts
  comparison/
    compliance-scorer.ts
    cross-file-checker.ts
    fast-path-resolver.ts
    structural-delta.ts
    vector-similarity.ts
  llm/
    prompt-builder.ts
    qualifier-prompt-builder.ts
    response-validator.ts
  qualifiers/
    context-analyzer.ts
    qualifier-resolver.ts
```

### Step 1.2: Copy the files

```bash
# From the ruleprobe repo root
cp -r ../ruleprobe-semantic/src/fingerprint src/semantic/engine/fingerprint
cp -r ../ruleprobe-semantic/src/comparison src/semantic/engine/comparison
cp -r ../ruleprobe-semantic/src/llm src/semantic/engine/llm
cp -r ../ruleprobe-semantic/src/qualifiers src/semantic/engine/qualifiers
cp ../ruleprobe-semantic/src/index.ts src/semantic/engine/index.ts
cp ../ruleprobe-semantic/src/rule-resolver.ts src/semantic/engine/rule-resolver.ts
cp ../ruleprobe-semantic/src/llm-escalation.ts src/semantic/engine/llm-escalation.ts
```

Do NOT copy `../ruleprobe-semantic/src/types.ts`. The ruleprobe repo already has `src/semantic/types.ts` with the same types. The engine files will import from the existing types file instead.

### Step 1.3: Copy the Anthropic caller

The Anthropic proxy from the API service becomes a local utility. Copy it into the semantic module:

```bash
cp ../ruleprobe-api-service/src/services/anthropic-proxy.ts src/semantic/anthropic-caller.ts
```

This file creates an `LlmCaller` function from an API key. It uses native `fetch` with no SDK dependencies. Review it to confirm it matches the `LlmCaller` type signature: `(model: string, prompt: string) => Promise<string>`.

### Step 1.4: Do NOT copy these files (they are being deleted)

From `ruleprobe-semantic`:
- `src/types.ts` (duplicate of `src/semantic/types.ts` in the public repo)

From `ruleprobe-api-service` (entire repo is being removed):
- `src/server.ts` (Hono HTTP server)
- `src/routes/analyze.ts` (HTTP route)
- `src/routes/validate.ts` (license validation route)
- `src/routes/usage.ts` (usage tracking route)
- `src/services/license-service.ts` (license key management)
- `src/services/rate-limiter.ts` (per-key rate limiting)
- `src/services/semantic-runner.ts` (thin wrapper, logic moves inline)
- `src/storage/license-store.ts` (SQLite interface)
- `src/storage/sqlite-store.ts` (SQLite implementation)
- `src/types/api-types.ts` (API request/response types)

---

## Phase 2: Rewire imports in the engine files

Every file in `src/semantic/engine/` currently imports from `'./types.js'` (the ruleprobe-semantic local types). These all need to point to the shared types file.

### Step 2.1: Fix type imports across all engine files

In every file under `src/semantic/engine/`, replace:
```typescript
import type { ... } from './types.js';
// or
import type { ... } from '../types.js';
```

With the relative path to the existing shared types:
```typescript
import type { ... } from '../types.js';
// (from src/semantic/engine/*.ts, '../types.js' resolves to src/semantic/types.ts)
```

For files in subdirectories (e.g. `src/semantic/engine/fingerprint/*.ts`), the path is:
```typescript
import type { ... } from '../../types.js';
// (from src/semantic/engine/fingerprint/*.ts, '../../types.js' resolves to src/semantic/types.ts)
```

For files in `src/semantic/engine/fingerprint/structural-features/*.ts`:
```typescript
import type { ... } from '../../../types.js';
```

**Systematic approach:** Run this from the repo root to find every import that needs changing:

```bash
grep -rn "from '\./types\|from '\.\./types" src/semantic/engine/ --include='*.ts'
```

Fix each one based on directory depth. The target is always `src/semantic/types.ts`.

### Step 2.2: Fix internal cross-references

The engine files import from each other using relative paths. Since the directory structure is preserved, most internal imports (`'./comparison/vector-similarity.js'`, `'./fingerprint/topic-registry.js'`, etc.) should work as-is from `src/semantic/engine/`.

Verify with:
```bash
cd /home/brad/projects/ruleprobe
npx tsc --noEmit 2>&1 | grep "semantic/engine"
```

Fix any remaining path mismatches. Common ones:
- `src/semantic/engine/index.ts` imports from `'./types.js'` should become `'../types.js'`
- `src/semantic/engine/rule-resolver.ts` imports from `'./types.js'` should become `'../types.js'`
- `src/semantic/engine/llm-escalation.ts` imports from `'./types.js'` should become `'../types.js'`

### Step 2.3: Reconcile type differences

The `ruleprobe-semantic` types file has two fields not in the public types:

1. `FeatureVector.compositePatterns: Record<string, number>`: add this to `src/semantic/types.ts`
2. `QualifierContext.variableReassigned: boolean`: add this to `src/semantic/types.ts`
3. `SemanticVerdict.method` includes `'topic-matched-no-profile'`: verify this is in the public types

Check for any other differences:
```bash
diff <(grep -E "export (type|interface|const)" ../ruleprobe-semantic/src/types.ts | sort) \
     <(grep -E "export (type|interface|const)" src/semantic/types.ts | sort)
```

Add any missing fields to `src/semantic/types.ts`. The public types file is now the single source of truth.

### Step 2.4: Add `LlmCaller` type to the shared types

The `LlmCaller` type is currently defined in `ruleprobe-semantic/src/types.ts`:

```typescript
export type LlmCaller = (
  model: string,
  prompt: string,
) => Promise<string>;
```

Add this to `src/semantic/types.ts` if not already present.

---

## Phase 3: Replace the HTTP client path with a direct call

### Step 3.1: Rewrite `src/semantic/index.ts`

The current `src/semantic/index.ts` does:
1. Extract raw vectors locally
2. Validate license key via HTTP
3. Send vectors to API via HTTP
4. Return verdicts

Replace it to:
1. Extract raw vectors locally (unchanged)
2. Create an `LlmCaller` from `ANTHROPIC_API_KEY`
3. Call `analyzeSemantic()` directly from `src/semantic/engine/index.ts`
4. Return verdicts

The new flow (pseudocode):

```typescript
import { extractRawVectors } from './local-extractor.js';
import { analyzeSemantic } from './engine/index.js';
import { createAnthropicCaller } from './anthropic-caller.js';
import type { SemanticAnalysisConfig } from './types.js';
import type { Rule } from '../types.js';

export async function analyzeProjectSemantic(
  projectDir: string,
  config: SemanticAnalysisConfig,
  rules: Rule[],
): Promise<SemanticPipelineResult> {
  // 1. Extract locally (unchanged)
  const payload = await extractRawVectors(projectDir);
  payload.rules = rules.map(ruleToPayload);

  // 2. Create local LLM caller
  const llmCaller = createAnthropicCaller({
    apiKey: config.anthropicApiKey,
  });

  // 3. Run engine directly
  const report = await analyzeSemantic(payload, llmCaller, {
    fastPathThreshold: config.fastPathThreshold,
    maxLlmCalls: config.maxLlmCalls,
    useCache: config.useCache,
  });

  return {
    performed: true,
    verdicts: report.verdicts,
    report,
    sentPayload: payload,
  };
}
```

Key changes:
- Remove all HTTP calls (`validateLicense`, `analyzeRemote`)
- Remove all license validation logic
- Remove retry/timeout logic (no network calls except Anthropic API, which has its own timeout)
- Import `analyzeSemantic` from `'./engine/index.js'` instead of calling it over HTTP
- Import `createAnthropicCaller` from `'./anthropic-caller.js'`

Keep `integrateSemanticResults()` and `ruleToPayload()` unchanged (they don't touch the network).

### Step 3.2: Delete `src/semantic/client.ts`

This file is the HTTP client that talked to the API service. It is completely replaced by the direct call above. Delete it.

```bash
rm src/semantic/client.ts
```

### Step 3.3: Rewrite `src/semantic/config.ts`

The current `config.ts` resolves:
- `licenseKey` (CLI flag > env var `RULEPROBE_LICENSE_KEY` > dotfile)
- `apiEndpoint` (env var > dotfile > localhost:3000)

Replace with:
- `anthropicApiKey` (CLI flag `--anthropic-key` > env var `ANTHROPIC_API_KEY` > dotfile)
- Remove `apiEndpoint` entirely (no remote server)
- Remove `licenseKey` entirely

The new config resolution follows the same pattern `--llm-extract` already uses for `OPENAI_API_KEY`:

```typescript
export function resolveSemanticConfig(
  projectDir: string,
  cliOptions: SemanticCliOptions,
): SemanticAnalysisConfig | null {
  const dotfile = readDotfileConfig(projectDir);

  const anthropicApiKey =
    cliOptions.anthropicKey ??
    process.env['ANTHROPIC_API_KEY'] ??
    dotfile?.anthropicApiKey ??
    undefined;

  if (anthropicApiKey === undefined) {
    return null;
  }

  return {
    anthropicApiKey,
    maxLlmCalls: cliOptions.maxLlmCalls ?? DEFAULT_MAX_LLM_CALLS,
    useCache: cliOptions.noCache !== true,
    fastPathThreshold: PRE_CALIBRATION_FAST_PATH_THRESHOLD,
  };
}
```

### Step 3.4: Update `SemanticAnalysisConfig` in `src/semantic/types.ts`

Change from:
```typescript
export interface SemanticAnalysisConfig {
  apiEndpoint: string;
  licenseKey: string;
  model?: string;
  maxLlmCalls?: number;
  useCache?: boolean;
  fastPathThreshold?: number;
}
```

To:
```typescript
export interface SemanticAnalysisConfig {
  anthropicApiKey: string;
  maxLlmCalls?: number;
  useCache?: boolean;
  fastPathThreshold?: number;
}
```

Remove `apiEndpoint`, `licenseKey`, and `model` (model is hardcoded in the prompt builder as `SEMANTIC_MODEL`).

---

## Phase 4: Update CLI flags

### Step 4.1: Replace `--license-key` with `--anthropic-key` in `src/cli.ts`

Find the analyze command option definitions (around line 185-202):

Remove:
```typescript
.option('--license-key <key>', 'license key for semantic tier')
```

Replace with:
```typescript
.option('--anthropic-key <key>', 'Anthropic API key for semantic analysis')
```

Update the options type accordingly:
```typescript
// Before
licenseKey?: string;
// After
anthropicKey?: string;
```

Keep these flags unchanged:
- `--semantic` (unchanged, enables semantic analysis)
- `--max-llm-calls <n>` (unchanged)
- `--no-cache` (unchanged)
- `--semantic-log` (unchanged)
- `--cost-report` (unchanged)

### Step 4.2: Update `src/commands/analyze.ts`

Change the semantic block (around lines 82-105):

Before:
```typescript
const cliOptions: SemanticCliOptions = {
  licenseKey: opts.licenseKey,
  ...
};
const config = resolveSemanticConfig(resolvedDir, cliOptions);
if (config === null) {
  process.stderr.write(
    'Semantic analysis requires a license key. ' +
    'Set --license-key, RULEPROBE_LICENSE_KEY env var, or .ruleprobe/config.json.\n',
  );
}
```

After:
```typescript
const cliOptions: SemanticCliOptions = {
  anthropicKey: opts.anthropicKey,
  ...
};
const config = resolveSemanticConfig(resolvedDir, cliOptions);
if (config === null) {
  process.stderr.write(
    'Semantic analysis requires an Anthropic API key. ' +
    'Set --anthropic-key, ANTHROPIC_API_KEY env var, or .ruleprobe/config.json.\n',
  );
}
```

### Step 4.3: Update `SemanticCliOptions` in `src/semantic/config.ts`

```typescript
// Before
export interface SemanticCliOptions {
  licenseKey?: string;
  maxLlmCalls?: number;
  noCache?: boolean;
  semanticLog?: boolean;
  costReport?: boolean;
}

// After
export interface SemanticCliOptions {
  anthropicKey?: string;
  maxLlmCalls?: number;
  noCache?: boolean;
  semanticLog?: boolean;
  costReport?: boolean;
}
```

---

## Phase 5: Copy and adapt tests

### Step 5.1: Copy semantic engine tests

```bash
# From ruleprobe repo root
mkdir -p tests/semantic/engine
cp -r ../ruleprobe-semantic/tests/comparison tests/semantic/engine/comparison
cp -r ../ruleprobe-semantic/tests/fingerprint tests/semantic/engine/fingerprint
cp -r ../ruleprobe-semantic/tests/llm tests/semantic/engine/llm
cp -r ../ruleprobe-semantic/tests/qualifiers tests/semantic/engine/qualifiers
cp ../ruleprobe-semantic/tests/index.test.ts tests/semantic/engine/index.test.ts
```

### Step 5.2: Fix test imports

Same pattern as Step 2.1. Every test file imports from the source files, so paths change:

```bash
# Find all test imports that reference source files
grep -rn "from '.*src/" tests/semantic/engine/ --include='*.ts'
```

Tests in `ruleprobe-semantic` imported like `'../../src/comparison/vector-similarity.js'`. In the new layout, they should import like `'../../../src/semantic/engine/comparison/vector-similarity.js'`.

Systematic approach: the relative path from `tests/semantic/engine/<subdir>/<file>.test.ts` to `src/semantic/engine/<subdir>/<file>.ts` is `../../../../src/semantic/engine/<subdir>/<file>.js`.

From `tests/semantic/engine/<file>.test.ts` to `src/semantic/engine/<file>.ts` is `../../../src/semantic/engine/<file>.js`.

### Step 5.3: Delete API service tests (not migrating)

Do NOT copy any tests from `ruleprobe-api-service`. These tested:
- HTTP routes (no longer exist)
- License service (removed)
- Rate limiter (removed)
- SQLite store (removed)
- Semantic runner (was a thin wrapper, now inline)
- Anthropic proxy (the only one worth keeping, handle in Step 5.4)

### Step 5.4: Add a test for the Anthropic caller

Create `tests/semantic/anthropic-caller.test.ts` that tests `createAnthropicCaller()`. Use a mock HTTP server (this is the acceptable mock boundary, same as the existing client tests). Port the relevant tests from `ruleprobe-api-service/tests/services/anthropic-proxy.test.ts`.

### Step 5.5: Update existing semantic client tests

The tests in `tests/semantic/client.test.ts` test the HTTP client. These are no longer needed. Delete:

```bash
rm tests/semantic/client.test.ts
```

Update `tests/semantic/index.test.ts` to test the new direct-call flow instead of the HTTP-based flow. The mock should now mock `analyzeSemantic` from the engine (or better: test with a mock `LlmCaller` that returns canned responses, exercising the real engine).

Update `tests/semantic/config.test.ts` to test `ANTHROPIC_API_KEY` resolution instead of `RULEPROBE_LICENSE_KEY`.

### Step 5.6: Verify test count

Before this migration, the three repos had:
- ruleprobe: 864 tests
- ruleprobe-semantic: 221 tests
- ruleprobe-api-service: 54 tests
- Total: 1,139

After migration, expect:
- ruleprobe: 864 + 221 = 1,085 tests (minus the deleted HTTP client tests, plus new Anthropic caller tests)
- API service tests (54): deleted, not migrated

Verify with `npx vitest run` and confirm all tests pass.

---

## Phase 6: Update `src/semantic/types.ts` (single source of truth)

### Step 6.1: Add missing fields from the semantic engine types

Compare `src/semantic/types.ts` (public repo) with the now-deleted `ruleprobe-semantic/src/types.ts`. Add any fields present in the engine types but missing from the public types:

1. `FeatureVector.compositePatterns: Record<string, number>` with JSDoc:
   ```typescript
   /**
    * Multi-node conjunction counts.
    * Each key is a composite pattern name (e.g. "try-catch-with-logging");
    * the value is the normalized per-file count of files exhibiting that
    * conjunction.
    */
   compositePatterns: Record<string, number>;
   ```

2. `QualifierContext.variableReassigned: boolean` with JSDoc:
   ```typescript
   /**
    * Whether the file contains variable reassignments.
    * Justifies using let over const or mutable state patterns.
    */
   variableReassigned: boolean;
   ```

3. Verify `SemanticVerdict.method` includes all variants:
   ```typescript
   method: 'structural-fast-path' | 'llm-assisted' | 'not-verifiable' | 'topic-matched-no-profile';
   ```

4. Add or verify `LlmCaller` type:
   ```typescript
   export type LlmCaller = (
     model: string,
     prompt: string,
   ) => Promise<string>;
   ```

### Step 6.2: Remove server-specific types

Remove `SemanticAnalysisConfig.apiEndpoint` and `SemanticAnalysisConfig.licenseKey` (done in Phase 3).

Remove types from the deleted `ruleprobe-api-service/src/types/api-types.ts` that appear nowhere else. These include HTTP request/response shapes, license validation types, etc. If any of them leaked into the public types file, remove them.

---

## Phase 7: Update vitest configuration

### Step 7.1: Ensure new test paths are included

Check `vitest.config.ts`. The test matcher should already cover `tests/semantic/**` since the semantic tests were added in v3.0.0. Confirm it also matches the deeper `tests/semantic/engine/**` subdirectories.

If the config uses an explicit include pattern, update it:
```typescript
include: ['tests/**/*.test.ts'],
```

### Step 7.2: Run the full test suite

```bash
npx vitest run
```

Fix any failures. Common issues:
- Import path mismatches (Phase 2 did not catch all)
- Missing type fields (Phase 6 did not add all)
- Tests that mocked the HTTP client need to mock the engine or LlmCaller instead

---

## Phase 8: Update documentation

### Step 8.1: Update README.md

**"Why" section (line ~22):** Remove "Optional semantic analysis (paid tier)". Replace with "Optional semantic analysis for pattern-matching and consistency rules."

**"Semantic Analysis (Paid Tier)" section:** Rename to "Semantic Analysis". Remove all mentions of:
- "paid tier"
- license keys
- API service
- "RuleProbe API service"
- "vectors are sent to the RuleProbe API service"

Replace the description with something like:
> RuleProbe extracts raw AST vectors locally and runs structural fingerprinting and similarity analysis to score compliance. An LLM is consulted only when vector similarity is ambiguous. Requires `ANTHROPIC_API_KEY`.

Update the flag table:
- Remove `--license-key <key>` row
- Add `--anthropic-key <key>` with description: "Anthropic API key (also: `ANTHROPIC_API_KEY` env var or `.ruleprobe/config.json`)"

Update the example commands:
```bash
# Before
ruleprobe analyze ./my-project --semantic --license-key <key>
# After
ruleprobe analyze ./my-project --semantic
# (assumes ANTHROPIC_API_KEY is set as env var)
```

**Authentication table:** Replace the "Semantic analysis" row:
- Flag: `--semantic`
- Required env var: `ANTHROPIC_API_KEY`
- When you need it: "Structural pattern and consistency checks"

Remove `RULEPROBE_LICENSE_KEY` from everywhere.

**Security section:** Update to reflect that all analysis runs locally. The only network calls are to the Anthropic API for LLM judgment, and those follow the same pattern as `--llm-extract` with OpenAI.

**Troubleshooting:** Replace "Semantic analysis skipped / license key errors" with guidance about `ANTHROPIC_API_KEY`.

**What's New in v3.0.0:** This section becomes partially inaccurate. Either update it to reflect the consolidation or add a "What's New in v4.0.0" section below it.

### Step 8.2: Update `docs/release-v3.0.0.md`

This document heavily references the three-repo architecture. Add a note at the top:

> **Note:** v4.0.0 consolidated the three-repo architecture into a single repo. The semantic engine now runs locally. See [docs/release-v4.0.0.md](release-v4.0.0.md) for details.

### Step 8.3: Create `docs/release-v4.0.0.md`

Document:
- Architecture change: three repos to one
- Semantic analysis is now fully open source (MIT)
- `--license-key` replaced by `ANTHROPIC_API_KEY`
- No API service required
- All analysis runs locally
- Files added/removed/moved
- Test count changes
- Breaking changes (CLI flag rename, removed API service)

### Step 8.4: Update `docs/cli-reference.md`

Replace `--license-key` with `--anthropic-key`. Remove any mentions of API endpoints, license tiers, etc.

### Step 8.5: Update `docs/api-reference.md`

Remove any references to the API service, license validation, or remote analysis. The programmatic API now includes `analyzeSemantic()` as a direct export.

### Step 8.6: Update `SECURITY.md`

Update the security model. Previously: "vectors sent to RuleProbe API service." Now: "all analysis runs locally; LLM calls go directly to Anthropic's API with the user's own key."

### Step 8.7: Update `.github/copilot-instructions.md`

This file is the root cause of the three-repo architecture. It should be rewritten to reflect the single-repo reality. Key changes:
- Remove "Critical: Three-Repo Architecture" section
- Remove all references to `ruleprobe-semantic` and `ruleprobe-api-service` as separate repos
- Update the project structure to show `src/semantic/engine/` as part of the main repo
- Remove license key, billing, and API service sections
- Remove "What NOT to Do" items about proprietary logic separation
- Keep all coding standards (they apply equally to the single repo)

---

## Phase 9: Update `package.json`

### Step 9.1: Check for new dependencies

The semantic engine (`ruleprobe-semantic`) has zero runtime dependencies (it uses only Node built-ins and the types from the public repo). No new dependencies needed.

The Anthropic caller (`anthropic-proxy.ts`) uses native `fetch`. No SDK dependency needed.

Verify: the Hono, better-sqlite3, and uuid dependencies from `ruleprobe-api-service` are NOT needed. Do not add them.

### Step 9.2: Version bump

Bump `package.json` version to `4.0.0` (this is a breaking change: CLI flag renamed, API service removed).

---

## Phase 10: Clean up and verify

### Step 10.1: Delete dead code

```bash
# HTTP client (replaced by direct call)
rm src/semantic/client.ts

# HTTP client tests
rm tests/semantic/client.test.ts
```

### Step 10.2: Remove unused imports

Run:
```bash
npx tsc --noEmit 2>&1 | grep "declared but"
```

Fix any unused imports across the codebase.

### Step 10.3: Check 300-line limit

```bash
find src/semantic/engine -name '*.ts' -exec sh -c 'lines=$(wc -l < "$1"); if [ "$lines" -gt 300 ]; then echo "$1: $lines lines"; fi' _ {} \;
```

If any files from `ruleprobe-semantic` exceed 300 lines, decompose them per the coding standards.

### Step 10.4: Check no `any` types

```bash
grep -rn ": any\b\|as any\b\|<any>" src/semantic/engine/ --include='*.ts'
```

Fix any occurrences.

### Step 10.5: Check no default exports

```bash
grep -rn "export default\|export { .* as default" src/semantic/engine/ --include='*.ts'
```

Fix any occurrences.

### Step 10.6: Check no em dashes

```bash
grep -rn '—' src/semantic/engine/ --include='*.ts'
```

Fix any occurrences.

### Step 10.7: Run full test suite

```bash
npx vitest run
```

All tests must pass. No exceptions.

### Step 10.8: Run typecheck

```bash
npx tsc --noEmit
```

Zero errors.

### Step 10.9: Test the actual CLI

```bash
# Without --semantic (should work unchanged)
npx tsx src/cli.ts analyze .

# With --semantic (should require ANTHROPIC_API_KEY)
npx tsx src/cli.ts analyze . --semantic
# Expected: error message about ANTHROPIC_API_KEY

# With --semantic and a key
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/cli.ts analyze . --semantic --cost-report
```

---

## Phase 11: Archive private repos

### Step 11.1: Archive on GitHub

After confirming everything works in the single repo:

1. Go to https://github.com/moonrunnerkc/ruleprobe-semantic/settings
2. Scroll to "Danger Zone" > "Archive this repository"
3. Archive it

4. Go to https://github.com/moonrunnerkc/ruleprobe-api-service/settings
5. Archive it

Archiving (not deleting) preserves the git history in case you need to reference it later.

### Step 11.2: Remove local clones (optional)

```bash
rm -rf ../ruleprobe-semantic
rm -rf ../ruleprobe-api-service
```

### Step 11.3: Stop the local API service

If the API service is still running locally (the `curl http://localhost:3737/health` from earlier), stop it:

```bash
# Find and kill the process
lsof -ti :3737 | xargs kill
```

---

## Phase 12: Commit and release

### Step 12.1: Commit

```bash
git add -A
git commit -m "v4.0.0: consolidate three repos into one, open-source semantic tier

- Move ruleprobe-semantic engine (40 files, ~3,600 lines) into src/semantic/engine/
- Move Anthropic caller from ruleprobe-api-service into src/semantic/
- Replace --license-key with ANTHROPIC_API_KEY (same pattern as --llm-extract)
- Remove HTTP client, license validation, API service dependency
- All analysis runs locally; no server required
- Semantic tier is now fully open source (MIT)
- Delete client.ts, rewrite config.ts and index.ts
- Port 18 test files from ruleprobe-semantic (~3,100 lines)
- Update README, docs, CLI reference, security model
- Breaking: --license-key flag removed, use ANTHROPIC_API_KEY env var"
```

### Step 12.2: Tag and push

```bash
git tag -a v4.0.0 -m "v4.0.0: single-repo consolidation, open-source semantic tier"
git push origin main --tags
```

### Step 12.3: Create GitHub release

```bash
gh release create v4.0.0 \
  --title "v4.0.0: Open-Source Semantic Tier" \
  --latest \
  --notes-file docs/release-v4.0.0.md
```

### Step 12.4: Publish to npm

```bash
npm publish
```

---

## Summary of what changes

| What | Before | After |
|------|--------|-------|
| Repos | 3 (1 public, 2 private) | 1 (public) |
| Semantic analysis | Server-side via API | Local, runs on user's machine |
| LLM calls | Proxied through API service | Direct to Anthropic from user's machine |
| Auth for semantic | `RULEPROBE_LICENSE_KEY` | `ANTHROPIC_API_KEY` |
| Server to deploy | Yes (Hono + SQLite on VPS) | None |
| Payment infrastructure | Stubbed, never built | None needed |
| License | MIT (public) + proprietary (private) | MIT (everything) |
| Contributor access | Could not see semantic engine | Full visibility |

| Files | Added to ruleprobe | Deleted from ruleprobe |
|-------|-------------------:|----------------------:|
| Source (from ruleprobe-semantic) | 39 | 0 |
| Source (Anthropic caller) | 1 | 0 |
| Source (deleted client.ts) | 0 | 1 |
| Tests (from ruleprobe-semantic) | 18 | 0 |
| Tests (deleted client tests) | 0 | 1 |
| **Net** | **+58 files** | **-2 files** |
