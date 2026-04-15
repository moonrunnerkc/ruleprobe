# Security Policy

## Security Model

RuleProbe reads files and produces reports. That is the entire operational scope.

- **No code execution.** ts-morph parses TypeScript into ASTs for structural analysis. It never runs the TypeScript compiler's emit pipeline and never executes scanned code.
- **No network calls by default.** RuleProbe has zero runtime network dependencies. It does not phone home, fetch updates, or transmit any data. Network calls happen only when you explicitly opt in with `--llm-extract`, `--rubric-decompose`, `--semantic`, or `ruleprobe run`.
- **No file modification.** RuleProbe never writes to the scanned directory. Output goes to stdout or to a user-specified `--output` path, nowhere else.
- **No auth, no database, no state.** Each invocation is stateless. Nothing is persisted between runs.

## Semantic Analysis Privacy

When `--semantic` is enabled, all analysis runs locally on your machine. The semantic engine (structural fingerprinting, vector similarity scoring, qualifier resolution) executes in-process. The only external calls are to the Anthropic API for LLM judgment when vector similarity is ambiguous. These calls use your own `ANTHROPIC_API_KEY` and go directly to Anthropic.

What is sent to the Anthropic API (only when LLM escalation is triggered):
- Numeric AST node type counts (e.g. `{ "TryStatement": 47, "CatchClause": 45 }`)
- Opaque AST sub-tree hashes (SHA-256 of canonical tree shape, not code text)
- Boolean structural flags (e.g. `{ inTightLoop: true, testCode: false }`)
- Rule text from instruction files

What is NEVER sent:
- Source code, variable names, function names, string literals
- Comments, import paths, module names, file paths, scope names

## Path Traversal Protection

User-supplied paths (instruction files and output directories) are resolved and bounded to the current working directory before any filesystem operation.

How it works:
1. The raw path is resolved with `path.resolve`
2. Symlinks are followed with `fs.realpathSync`
3. The resolved path is checked to be a descendant of `process.cwd()`
4. If the path escapes the working directory, the command fails with a clear error

Symlinks are skipped by default during directory walks. Use `--allow-symlinks` to follow them when you know the targets are trusted.

## Dependency Policy

All dependencies are pinned to exact versions in package.json (no `^` or `~` ranges). This prevents silent upgrades from introducing compromised packages.

The project includes an `npm audit` script for CI integration:

```bash
npm run audit
```

### Current audit status

As of v0.1.0, `npm audit` reports 5 moderate advisories in `esbuild`, a transitive dev dependency of vitest. These affect the vitest development server only and have no impact on RuleProbe's runtime behavior. esbuild is not bundled in the published package.

## Reporting Security Issues

Report security issues by opening a GitHub issue with the `security` label at [github.com/moonrunnerkc/ruleprobe](https://github.com/moonrunnerkc/ruleprobe/issues).

For issues that should not be disclosed publicly before a fix, email the maintainer directly. Contact information is in the repository's GitHub profile.
