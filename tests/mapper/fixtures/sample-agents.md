# Code Style

- Never use `any`. Use `unknown` and narrow.
- Always use named exports. No `export default`.
- Use kebab-case for filenames.
- Files must not exceed 300 lines.
- Every public function must have a JSDoc comment.
- Prefer `const` over `let`.
- No `var` declarations.
- No `console.log` in production code.

# Naming

- Use camelCase for variables and functions.
- Use PascalCase for types, interfaces, and classes.

# Error Handling

- Catch blocks must not be empty.
- Only throw Error objects.

# Imports

- No namespace imports (import * as).
- Imports must use relative paths, not path aliases.