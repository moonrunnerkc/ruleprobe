# RuleProbe v4.0.0

Released: April 2026

## Architecture change: three repos to one

v3.0.0 split the semantic analysis across three repositories to protect proprietary IP:
- `ruleprobe` (public, MIT): CLI + thin HTTP client
- `ruleprobe-semantic` (private): ASPE engine (fingerprinting, similarity, LLM escalation)
- `ruleprobe-api-service` (private): HTTP server, license gating, Anthropic proxy

v4.0.0 consolidates everything into the single `ruleprobe` repo. The semantic engine is now fully open source under MIT. No separate server, no license keys, no private repos.

## What moved where

| Source | Destination | Files |
|--------|-------------|------:|
| `ruleprobe-semantic/src/` | `src/semantic/engine/` | 39 |
| `ruleprobe-api-service/src/services/anthropic-proxy.ts` | `src/semantic/anthropic-caller.ts` | 1 |
| `ruleprobe-semantic/tests/` | `tests/semantic/engine/` | 18 |

## What was deleted

| File | Reason |
|------|--------|
| `src/semantic/client.ts` | HTTP client (replaced by direct engine call) |
| `tests/semantic/client.test.ts` | HTTP client tests (no longer needed) |
| All `ruleprobe-api-service` code | Server, routes, license service, rate limiter, SQLite store |

## Breaking changes

### CLI flag rename

`--license-key` is removed. Use `ANTHROPIC_API_KEY` environment variable instead (same pattern as `--llm-extract` with `OPENAI_API_KEY`).

Before:
```bash
ruleprobe analyze ./my-project --semantic --license-key <key>
```

After:
```bash
ANTHROPIC_API_KEY=sk-ant-... ruleprobe analyze ./my-project --semantic
```

Or pass it explicitly:
```bash
ruleprobe analyze ./my-project --semantic --anthropic-key <key>
```

### No API service required

The `RULEPROBE_API_ENDPOINT` environment variable and `apiEndpoint` config field are removed. All analysis runs locally.

### Config file changes

In `.ruleprobe/config.json`, replace `licenseKey` with `anthropicApiKey`:

Before:
```json
{ "licenseKey": "rp-..." }
```

After:
```json
{ "anthropicApiKey": "sk-ant-..." }
```

## Data flow change

Before (v3.0.0):
1. CLI extracts raw vectors locally
2. CLI sends vectors over HTTP to API service
3. API service runs semantic engine, calls Anthropic API
4. API service returns verdicts to CLI

After (v4.0.0):
1. CLI extracts raw vectors locally (unchanged)
2. CLI runs semantic engine directly (no network)
3. Engine calls Anthropic API with user's key (only when LLM needed)
4. CLI integrates verdicts (unchanged)

## Test count

| Before | After |
|-------:|------:|
| ruleprobe: 864 | ruleprobe: 1,085+ |
| ruleprobe-semantic: 221 | (merged into ruleprobe) |
| ruleprobe-api-service: 54 | (deleted) |
| **Total: 1,139** | **Total: 1,085+** |

API service tests (54) were not migrated as they tested HTTP routes, license validation, rate limiting, and SQLite storage, none of which exist in the consolidated architecture.

## Migration checklist

1. Remove `RULEPROBE_LICENSE_KEY` from environment variables and CI secrets
2. Set `ANTHROPIC_API_KEY` where semantic analysis is used
3. Replace `--license-key <key>` with `--anthropic-key <key>` (or just set the env var)
4. Remove `apiEndpoint` from `.ruleprobe/config.json` if present
5. Replace `licenseKey` with `anthropicApiKey` in `.ruleprobe/config.json` if present
6. Stop any running `ruleprobe-api-service` instances
