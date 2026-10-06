# RuleProbe

**Keep AI coding instructions and ESLint enforcement in sync.**

RuleProbe translates supported instructions from `AGENTS.md`, `CLAUDE.md`, and related files into ESLint configuration fragments. It checks whether those requirements match the ESLint configuration applied to your source files, and can turn supported ESLint rules back into instruction prose.

[![npm version](https://img.shields.io/npm/v/ruleprobe?style=flat-square)](https://www.npmjs.com/package/ruleprobe)
[![MIT license](https://img.shields.io/github/license/moonrunnerkc/ruleprobe?style=flat-square)](LICENSE)

[Quick start](#quick-start) · [Workflows](#workflows) · [Coverage](#coverage-and-limits) · [GitHub Action](#github-action) · [CLI reference](docs/cli-reference.md)

For maintainers using AI coding agents alongside ESLint, RuleProbe helps answer three questions:

- Which written rules can become executable lint rules?
- Which requirements are missing from the effective ESLint configuration?
- Which supported ESLint rules can be documented for an agent?

The translation and drift workflows are deterministic and require no LLM or API key. ESLint runs the resulting checks; RuleProbe checks the connection between your instructions and configuration.

> [!IMPORTANT]
> This README describes the development source. The published npm package, `4.5.0`, predates `--preview`, `--config-json`, scoped instruction discovery, and the newer drift safeguards. The `@v4` Action tag also points to older code. Use the source installation and pinned Action revision below for the behavior documented here.

## See the gap

Given these instructions in `AGENTS.md`:

```markdown
# Coding rules

- Never use var.
- No empty catch blocks.
```

Check them against your ESLint configuration:

```bash
ruleprobe drift AGENTS.md eslint.config.mjs
```

If the corresponding rules are missing, the report includes:

```text
  [md-only] no-var
  [md-only] no-empty
```

Reports also identify the instruction lines, translation status, source paths checked, and paths where the requirements are enforced on both sides. A clean comparison describes configuration coverage. It does not prove that the code passes ESLint or that an agent completed its task correctly.

## Quick start

### Install the documented source

Use Node.js 24 or Node.js 22.13+, npm, and Git. These commands select the source revision used by this guide:

```bash
git clone https://github.com/moonrunnerkc/ruleprobe.git
cd ruleprobe
git checkout 81453c1b8446adcc1a74d60605d6198be90ec146
npm ci --ignore-scripts
npm run build
npm link --ignore-scripts
cd ..
```

### Try a complete example

Create a small JavaScript project. The dependency versions below match the versions used to check this example.

```bash
mkdir ruleprobe-demo
cd ruleprobe-demo
npm init -y
npm install --save-dev --save-exact eslint@9.39.4 @typescript-eslint/parser@8.59.2
mkdir src
printf "export const serviceName = 'ruleprobe-demo';\n" > src/index.js
printf '# Coding rules\n\n- Never use var.\n- No empty catch blocks.\n' > AGENTS.md
```

Preview the generated fragment, then write it:

```bash
ruleprobe lint-config AGENTS.md --output eslint.ruleprobe.mjs --preview
ruleprobe lint-config AGENTS.md --output eslint.ruleprobe.mjs
```

Create `eslint.config.mjs` with:

```javascript
import ruleprobe from './eslint.ruleprobe.mjs';

export default [...ruleprobe];
```

Check the effective configuration, then lint the source:

```bash
ruleprobe drift AGENTS.md eslint.config.mjs --files src/index.js
npx eslint src/index.js
```

The drift report should show `Comparison: compared`, both instructions enforced for `src/index.js`, and no drift. ESLint should exit successfully.

### Add it to an existing project

Run the same translation commands from your project root, using your instruction filename. Put `eslint.ruleprobe.mjs` beside the flat config that imports it. Add the import and spread to your existing configuration, preserving its other entries.

Review the generated rules before integrating them. Every flat fragment imports `@typescript-eslint/parser`; additional mappings can import `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-jsdoc`, or `eslint-plugin-unicorn`. Install the packages imported by your fragment using versions compatible with your project's ESLint and Node.js.

Later flat-config entries can override earlier ones. Run drift against the final configuration after integration. Generating a file alone does not activate enforcement.

## Workflows

### Translate instructions into a config fragment

Use `lint-config` as shown in the quick start whenever your instructions change. `--preview` writes nothing. `--output` prints and writes the fragment, refusing to overwrite a file without the RuleProbe ownership marker. Regeneration replaces the owned fragment, so keep manual configuration in the consuming config.

Flat config is the default. `--format legacy` emits JSON for older ESLint setups; scoped instructions require flat output.

### Check instruction and configuration drift

```bash
ruleprobe drift AGENTS.md eslint.config.mjs
ruleprobe drift . eslint.config.mjs --format markdown
ruleprobe drift AGENTS.md eslint.config.mjs --format json --output drift-report.json
```

Pass a directory to include all discovered instruction files. Normal drift mode uses the project's installed ESLint to resolve configuration for each checked JavaScript or TypeScript file. Install the project's dependencies first. Use `--files` to limit the checked paths.

**Trust boundary:** loading a JavaScript or TypeScript ESLint config executes that config and its imports. Use a trusted repository or an isolated, unprivileged environment. For data-only comparisons, see [Security](#security).

| Exit code | Meaning |
| --- | --- |
| `0` | A comparison was completed with no missing or mismatched requirements. Extra ESLint rules are informational. |
| `1` | Missing or mismatched requirements, unsupported or partial instruction coverage on applicable paths, a static fallback, or nothing compared. |
| `2` | An execution error prevented the check. |

Check `comparisonStatus` and `pathsChecked` in JSON reports. `hasDrift: false` alone does not establish that anything was compared. Paths listed as enforced on both sides can help you review redundant instructions; they are not evidence that removing those instructions will preserve agent behavior.

### Extract instruction prose from ESLint

```bash
ruleprobe extract .eslintrc.json --output rules-section.md
```

Review the generated Markdown before adding it to an instruction file. Extraction uses supported rule mappings, skips stylistic rules, and reports unmapped rules. It does not resolve inherited configuration, and flat-config entries with `files` or `ignores` are excluded. A scoped config can therefore produce an empty rules section. Extraction is not a lossless round trip.

### Inspect instruction coverage

```bash
ruleprobe parse AGENTS.md --show-unparseable
ruleprobe analyze . --format json
```

`parse` shows extracted rules and unparseable content. `analyze` discovers instruction files and reports detected rule conflicts, redundancies, and category coverage. It is not a complete semantic analysis of every instruction.

## Coverage and limits

Discovery recognizes root-level `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `.windsurfrules`, and `.rules`, plus `.github/copilot-instructions.md`.

| Scoped format | Applicability |
| --- | --- |
| Nested `AGENTS.md` | Its containing directory and descendants. |
| `.cursor/rules/*.mdc` | Frontmatter `globs`, or all paths when `alwaysApply: true`. Rules without either are conditional. |
| `.github/instructions/**/*.instructions.md` | Frontmatter `applyTo` globs. |

Relative inclusion globs are supported; negation, absolute paths, and parent traversal are rejected. Conditional Cursor rules emit no always-on ESLint rules. Invalid scope metadata fails explicitly.

- **Supported patterns only.** RuleProbe recognizes specific instruction patterns. Arbitrary prose, subjective guidance, and every rule understood by an agent are not automatically translatable. Inferred proxy checks do not count as enforcement of the original instruction.
- **Review translation semantics.** Inspect the emitted options and scope. For example, the relative-import mapping also rejects bare package imports.
- **Coverage depends on checked paths.** A zero-rule or zero-path comparison is not a successful verification. Independently configured packages need separate runs against their own ESLint configs.
- **Configuration checks are bounded.** Static parsing cannot establish per-file enforcement or resolve inherited configuration. Keep ESLint and your tests in CI.

See the [matcher reference](docs/matchers.md) for supported instruction patterns and the [CLI reference](docs/cli-reference.md) for command options. Legacy `verify` remains available for direct code checks; its optional LLM features are separate from the primary translation and drift workflows.

## GitHub Action

For a repository with `AGENTS.md`, `eslint.config.mjs`, and an npm lockfile, save this as `.github/workflows/ruleprobe.yml`:

```yaml
name: RuleProbe drift

on:
  pull_request:

permissions:
  contents: read
  pull-requests: read

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '22'
      - run: npm ci --ignore-scripts
      - uses: moonrunnerkc/ruleprobe@81453c1b8446adcc1a74d60605d6198be90ec146
        with:
          instruction-file: AGENTS.md
          eslint-file: eslint.config.mjs
          comment-on-pr: 'false'
          fail-on-drift: 'true'
```

This uses the documented source revision and read-only token permissions. It does not post comments or regenerate files. The Action checks changed filenames and skips drift when neither an explicitly configured input nor a recognized instruction/config filename changed. To check every PR regardless of changed filenames, invoke the CLI directly in your workflow.

The job executes the checked-out ESLint config. Keep it isolated from secrets and write credentials; do not run untrusted PR configuration in a privileged `pull_request_target` job. All inputs are listed in [action.yml](action.yml).

## Security

Use a trusted RuleProbe installation and a pre-exported per-file JSON snapshot to compare untrusted repository data without importing its ESLint config, plugins, or RuleProbe config:

```bash
ruleprobe drift AGENTS.md eslint-snapshot.json --config-json
```

The snapshot contains resolved rules keyed by source path relative to the config directory:

```json
{
  "files": {
    "src/index.js": {
      "rules": {
        "no-var": [2],
        "no-empty": [2, { "allowEmptyCatch": false }]
      }
    }
  }
}
```

Export each entry from ESLint's `calculateConfigForFile()` in a trusted or isolated environment. The snapshot producer is responsible for its accuracy and freshness. A plain JSON rules object is a static fallback, not verified per-file enforcement.

Optional `--llm-extract`, `--rubric-decompose`, and `--semantic` features call external APIs when enabled. See [SECURITY.md](SECURITY.md) for execution boundaries and reporting security issues.

## Documentation and contributing

[CLI reference](docs/cli-reference.md) · [Matcher reference](docs/matchers.md) · [Programmatic API](docs/api-reference.md) · [Changelog](CHANGELOG.md)

To contribute, read [AGENTS.md](AGENTS.md), install dependencies with `npm ci --ignore-scripts`, and run:

```bash
npm run build
npm test
```

[Report a bug](https://github.com/moonrunnerkc/ruleprobe/issues) with the instruction text, relevant config, command, and observed result. Include a small reproduction when possible.

## License

[MIT](LICENSE), maintained by [Brad Kinnard](https://github.com/moonrunnerkc).
