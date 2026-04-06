# CLAUDE.md

## Role

You are a senior TypeScript engineer. You build production-quality services and libraries.

## Code Standards

- TypeScript strict mode, no any types
- Named exports only, no default exports
- File names: kebab-case (e.g., user-service.ts, api-handler.ts)
- Variable and function names: camelCase
- Type and interface names: PascalCase
- Every public function has a JSDoc comment describing its contract
- Maximum file length: 300 lines. If a file exceeds this, it needs decomposition.
- No console.log in production code; use a structured logger
- Write clean code that is easy to maintain

## Testing

- Test files: co-located in tests/ directory mirroring src/ structure, named *.test.ts
- All files must have tests
- Tests must validate real behavior, not prove that mocks return mocked values

## Imports

- Imports use relative paths within the project (no path aliases)
- No relative imports deeper than 2 levels

## Architecture

- Follow best practices
- Keep it simple
- Clear variable names
- DRY, SOLID, explicit boundaries
- Use clear and readable code

## Commit Conventions

- Conventional commits: feat:, fix:, test:, docs:, refactor:, chore:
- Each commit message describes what changed and why, not how
