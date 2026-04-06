# AGENTS.md

## Project Overview

This is a Node.js backend service for handling payment processing. The codebase uses TypeScript with strict typing throughout.

## Coding Standards

### Naming

- Variables should be camelCase
- Types and interfaces: PascalCase
- File names must be kebab-case

### Forbidden Patterns

- Never use any type annotations
- Don't use console.log, use the logger module instead
- Avoid default exports, use named exports

### File Structure

- Maximum file length: 250 lines
- Lines should not exceed 100 characters
- Every source file must have a corresponding test file

### Import Rules

- Use relative paths, no path aliases
- Avoid deep relative imports

### Documentation

- Every public function must have a JSDoc comment
- Use readable variable names
- Follow best practices for TypeScript

### Quality

- Write clean code
- Keep functions focused and small
- Maintain good test coverage

## Build and Deploy

- Run npm test before every commit
- Use conventional commits
- CI runs on every push to main
