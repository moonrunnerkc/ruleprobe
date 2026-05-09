# Built-in Matchers

RuleProbe ships 34 ESLint-mappable matchers across 7 categories. Each matcher maps a natural-language instruction to a deterministic check.

The parser is conservative: if it can't confidently map an instruction to a check, it skips it and reports the line as unparseable. Use `--show-unparseable` to see skipped lines, and `--llm-extract` or `--rubric-decompose` to handle the remainder. Rules that cannot map to ESLint (test file requirements, project config, git conventions) are reported as unmappable so you can enforce them through other tooling.

## Verifier Engines

| Verifier | Scope | Notes |
|----------|-------|-------|
| AST | TypeScript / JavaScript | Full structural analysis via ts-morph |
| AST (--project) | TypeScript / JavaScript | Requires `--project tsconfig.json` for cross-file type checking |
| Regex | Any text file | Line-level pattern matching |
| Filesystem | Disk structure | File existence, naming, config presence |

## Category Summary

| Category | Matchers | Verifier(s) |
|----------|------:|-------------|
| naming | 5 | AST, Filesystem |
| forbidden-pattern | 5 | AST, Regex |
| structure | 4 | AST, Filesystem |
| import-pattern | 4 | AST |
| error-handling | 2 | AST |
| type-safety | 5 | AST, Regex |
| code-style | 9 | AST, Regex |
| **Total** | **34** | |

## Matcher Table

### naming (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "camelCase for variables" | Variable and function names in AST | AST |
| "camelCase" (general) | Variable and function names in AST | AST |
| "PascalCase for types" | Interface and type alias names | AST |
| "kebab-case file names" | File names on disk | Filesystem |
| "UPPER_CASE for constants" | Const declarations at module scope | AST |

### forbidden-pattern (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no any types" | Type annotations in AST | AST |
| "no console.log" | Call expressions in AST | AST |
| "no console.warn/error" | Extended console method calls | AST |
| "no var" | Var declarations in all scopes | AST |
| "max line length 120" | Line character count | Regex |

### structure (4)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "named exports only" | Export declarations | AST |
| "max 300 lines per file" | File line count | Filesystem |
| "JSDoc on public functions" | JSDoc presence | AST |
| "no unused exports" | Exported symbols imported elsewhere | AST (--project) |

### import-pattern (4)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no path aliases" | Import specifiers | AST |
| "no deep relative imports" | Import depth | AST |
| "no namespace imports" | Star import detection | AST |
| "no wildcard re-exports" | `export *` detection | AST |

### error-handling (2)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no empty catch blocks" | Catch clause body inspection | AST |
| "throw Error instances only" | Throw expression types | AST |

### type-safety (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no enums" | Enum declaration detection | AST |
| "no type assertions" | `as` keyword / angle bracket casts | AST |
| "no non-null assertions" | `!` postfix operator | AST |
| "no @ts-ignore / @ts-nocheck" | Directive comment detection | Regex |
| "no implicit any" | Untyped parameters and variables | AST (--project) |

### code-style (9)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no TODO/FIXME comments" | Comment marker detection | Regex |
| "consistent semicolons" | Missing or unexpected semicolons | Regex |
| "prefer const" | `let` that is never reassigned | AST |
| "no nested ternary" | Ternary depth analysis | AST |
| "no magic numbers" | Numeric literal usage | AST |
| "no else after return" | Redundant else branches | AST |
| "max function length" | Function body line count | AST |
| "max parameters per function" | Parameter count | AST |
| "use single quotes" | Quote consistency | Regex |

## Adding Matchers

Matchers are defined across 4 `src/parsers/rule-patterns*.ts` files. Each matcher has:

- **id**: unique slug (e.g., `naming-camelcase-variables`)
- **category**: one of the 7 categories above
- **keywords / pattern**: regex that matches the natural-language instruction
- **verifier**: which engine runs the check
- **patternType**: the specific check function (e.g., `camelCase`, `no-any`, `max-line-length`)
- **filePattern**: glob for target files (e.g., `*.ts`, `*.py`)

To add a new matcher, add an entry to the appropriate `rule-patterns*.ts` file, implement the check function in the corresponding verifier module, and add tests.
