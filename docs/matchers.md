# Built-in Matchers

RuleProbe ships 102 matchers across 14 categories. Each matcher maps a natural-language instruction to a deterministic check.

The parser is conservative: if it can't confidently map an instruction to a check, it skips it and reports the line as unparseable. Use `--show-unparseable` to see skipped lines, and `--llm-extract` or `--rubric-decompose` to handle the remainder.

## Verifier Engines

| Verifier | Scope | Notes |
|----------|-------|-------|
| AST | TypeScript / JavaScript | Full structural analysis via ts-morph |
| AST (--project) | TypeScript / JavaScript | Requires `--project tsconfig.json` for cross-file type checking |
| Tree-sitter | TypeScript, JavaScript, Python, Go | Naming and function-length checks via WASM grammars |
| Regex | Any text file | Line-level pattern matching |
| Filesystem | Disk structure | File existence, naming, config presence |
| Preference | TypeScript / JavaScript | Compliance ratios for "prefer X over Y" patterns |
| Tooling | package.json / lockfiles / configs | Package manager, test framework, linter/formatter detection |
| Config-file | CI configs, git hooks, env tools | CI pipeline, pre-commit hooks, developer environment tool detection |
| Git-history | Git log | Commit message conventions, branch naming, signed commits |

## Category Summary

| Category | Matchers | Verifier(s) |
|----------|------:|-------------|
| naming | 9 | AST, Filesystem, Tree-sitter |
| forbidden-pattern | 5 | AST, Regex |
| structure | 9 | AST, Filesystem |
| test-requirement | 5 | AST, Filesystem, Regex |
| import-pattern | 5 | AST, Regex |
| error-handling | 4 | AST |
| type-safety | 6 | AST, Regex |
| code-style | 12 | AST, Regex, Tree-sitter |
| dependency | 2 | Filesystem, Regex |
| preference | 8 | Preference |
| file-structure | 5 | Filesystem |
| tooling | 14 | Tooling, Config-file |
| testing | 3 | Filesystem, Regex |
| workflow | 15 | Config-file, Git-history |
| **Total** | **102** | |

## Matcher Table

### naming (9)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "camelCase for variables" | Variable and function names in AST | AST |
| "camelCase" (general) | Variable and function names in AST | AST |
| "PascalCase for types" | Interface and type alias names | AST |
| "kebab-case file names" | File names on disk | Filesystem |
| "UPPER_CASE for constants" | Const declarations at module scope | AST |
| "kebab-case directories" | Directory names on disk | Filesystem |
| "Python snake_case functions" | Python function names via tree-sitter | Tree-sitter |
| "Python PascalCase classes" | Python class names via tree-sitter | Tree-sitter |
| "Go naming conventions" | Exported PascalCase, unexported camelCase | Tree-sitter |

### forbidden-pattern (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no any types" | Type annotations in AST | AST |
| "no console.log" | Call expressions in AST | AST |
| "no console.warn/error" | Extended console method calls | AST |
| "no var" | Var declarations in all scopes | AST |
| "no TODO/FIXME comments" | Comment marker detection | Regex |

### structure (9)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "named exports only" | Export declarations | AST |
| "max 300 lines per file" | File line count | Filesystem |
| "max line length 120" | Line character count | Regex |
| "JSDoc on public functions" | JSDoc presence | AST |
| "strict mode" | tsconfig.json compilerOptions.strict | Filesystem |
| "no barrel files" | Index re-export detection | AST |
| "README must exist" | File existence on disk | Filesystem |
| "CHANGELOG must exist" | File existence on disk | Filesystem |
| "formatter config required" | .prettierrc / .eslintrc detection | Filesystem |

### test-requirement (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "test file for every source file" | Matching test files exist | Filesystem |
| "test files named *.test.ts" | Test file naming convention | Filesystem |
| "no .only in tests" | Focused test detection | Regex |
| "no .skip in tests" | Skipped test detection | Regex |
| "no setTimeout in tests" | Timer usage in test files | AST |

### import-pattern (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no path aliases" | Import specifiers | AST |
| "no deep relative imports" | Import depth | AST |
| "no namespace imports" | Star import detection | AST |
| "ban specific packages" | Forbidden import sources | Regex |
| "no wildcard re-exports" | `export *` detection | AST |

### error-handling (4)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no empty catch blocks" | Catch clause body inspection | AST |
| "throw Error instances only" | Throw expression types | AST |
| "try/catch for async operations" | Async function error handling | AST |
| "contextual error logging" | Error context in log calls | AST |

### type-safety (6)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no enums" | Enum declaration detection | AST |
| "no type assertions" | `as` keyword / angle bracket casts | AST |
| "no non-null assertions" | `!` postfix operator | AST |
| "no @ts-ignore / @ts-nocheck" | Directive comment detection | Regex |
| "no implicit any" | Untyped parameters and variables | AST (--project) |
| "no unused exports" | Exported symbols imported elsewhere | AST (--project) |

### code-style (12)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "no nested ternary" | Ternary depth analysis | AST |
| "no magic numbers" | Numeric literal usage | AST |
| "no else after return" | Redundant else branches | AST |
| "max function length" | Function body line count | AST |
| "max parameters per function" | Parameter count | AST |
| "single/double quote style" | Quote consistency in imports | Regex |
| "prefer const" | `let` that is never reassigned | AST |
| "consistent semicolons" | Missing or unexpected semicolons | Regex |
| "concise conditionals" | Unnecessary braces around single-statement bodies | AST |
| "Python max function length" | Python function body line count | Tree-sitter |
| "Go max function length" | Go function body line count | Tree-sitter |
| "no unresolved imports" | Relative import resolution | AST (--project) |

### dependency (2)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "pin dependency versions" | Exact version strings in package.json | Filesystem |
| "ban specific packages" | Package presence in dependencies | Regex |

### preference (8)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "prefer const over let" | Ratio of const to let declarations | Preference |
| "prefer named over default exports" | Ratio of named to default exports | Preference |
| "prefer interface over type" | Ratio of interface to type alias declarations | Preference |
| "prefer async/await over .then()" | Ratio of await to .then() chains | Preference |
| "prefer arrow over function declarations" | Ratio of arrow to function expressions | Preference |
| "prefer template literals" | Ratio of template literals to concatenation | Preference |
| "prefer optional chaining" | Ratio of ?. to nested conditionals | Preference |
| "prefer functional components" | Ratio of functional to class components | Preference |

### file-structure (5)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "tests/ directory exists" | Directory existence | Filesystem |
| "components/ directory exists" | Directory existence | Filesystem |
| ".env file exists" | File existence | Filesystem |
| "module index files" | Index file presence per module | Filesystem |
| "src/ directory exists" | Directory existence | Filesystem |

### tooling (14)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "use pnpm" | pnpm lockfile present | Tooling |
| "use yarn" | yarn lockfile present | Tooling |
| "use bun" | bun lockfile present | Tooling |
| "use vitest" | vitest in devDependencies or config | Tooling |
| "use jest" | jest in devDependencies or config | Tooling |
| "use pytest" | pytest in requirements/pyproject | Tooling |
| "use eslint" | eslint config present | Tooling |
| "use prettier" | prettier config present | Tooling |
| "use biome" | biome config present | Tooling |
| "use flox" | flox environment detected | Config-file |
| "use nix" | nix flake or shell.nix detected | Config-file |
| "use devcontainer" | devcontainer.json detected | Config-file |
| "use mise" | mise config detected | Config-file |
| "use volta" | volta config detected | Config-file |

### testing (3)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "colocate test files" | Test files next to source files | Filesystem |
| "use describe/it blocks" | Test structure patterns | Regex |
| "no console in tests" | Console calls in test files | Regex |

### workflow (15)

| Example instruction | What gets checked | Verifier |
|-------------------|-------------------|----------|
| "conventional commits" | Commit message format in git log | Git-history |
| "commit prefix required" | Commit message prefix pattern | Git-history |
| "branch naming convention" | Branch name pattern | Git-history |
| "signed commits" | GPG signature on commits | Git-history |
| "commit scope required" | Scope in conventional commit messages | Git-history |
| "CI runs lint" | Lint step in CI config | Config-file |
| "CI runs tests" | Test step in CI config | Config-file |
| "CI runs typecheck" | Typecheck step in CI config | Config-file |
| "CI config present" | CI config file existence | Config-file |
| "pre-commit runs tests" | Test hook in pre-commit config | Config-file |
| "pre-commit runs lint" | Lint hook in pre-commit config | Config-file |
| "husky configured" | Husky hooks directory present | Config-file |
| "lefthook configured" | Lefthook config present | Config-file |
| "npm test script" | test script in package.json | Config-file |
| "npm lint script" | lint script in package.json | Config-file |

## Adding Matchers

Matchers are defined across 10 `src/parsers/rule-patterns*.ts` files. Each matcher has:

- **id**: unique slug (e.g., `naming-camelCase-1`)
- **category**: one of the 14 categories above
- **keywords / pattern**: regex that matches the natural-language instruction
- **verifier**: which engine runs the check
- **patternType**: the specific check function (e.g., `camelCase`, `no-any`, `max-line-length`)
- **filePattern**: glob for target files (e.g., `*.ts`, `*.py`)

To add a new matcher, add an entry to the appropriate `rule-patterns*.ts` file, implement the check function in the corresponding verifier module, and add tests.
