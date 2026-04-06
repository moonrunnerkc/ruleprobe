# Task: String Utility Module

Build a TypeScript utility module with three string manipulation functions and full test coverage.

## Functions

### slugify(input: string): string

Convert a string into a URL-friendly slug.

- Convert to lowercase
- Replace spaces and special characters with hyphens
- Collapse consecutive hyphens into one
- Strip leading and trailing hyphens
- Handle unicode characters by removing them

Examples:
- `"Hello World"` -> `"hello-world"`
- `"  Multiple   Spaces  "` -> `"multiple-spaces"`
- `"Special @#$ Characters!"` -> `"special-characters"`

### truncate(input: string, maxLength: number, suffix?: string): string

Truncate a string to a maximum length, appending a suffix if truncated.

- Default suffix is `"..."`
- If the string fits within maxLength, return it unchanged
- The returned string (including suffix) must not exceed maxLength
- Never break in the middle of a word; truncate at the last space before the limit

Examples:
- `truncate("Hello World", 50)` -> `"Hello World"`
- `truncate("Hello World", 8)` -> `"Hello..."`
- `truncate("Hello World", 8, "…")` -> `"Hello W…"`

### extractDomain(url: string): string | null

Extract the domain name from a URL string.

- Handle URLs with or without protocol (`https://`, `http://`)
- Strip `www.` prefix if present
- Return `null` for invalid or empty input
- Handle URLs with ports, paths, and query strings

Examples:
- `"https://www.example.com/page"` -> `"example.com"`
- `"http://api.github.com:8080/v1"` -> `"api.github.com"`
- `"not-a-url"` -> `null`

## Expected Output Structure

```
src/
  utils/string-utils.ts          # All three functions
tests/
  utils/string-utils.test.ts     # Tests for all three functions
```

## Deliverables

1. All three functions implemented and exported
2. Type annotations on all parameters and return values
3. Edge case handling (empty strings, null-ish input, extreme lengths)
4. Unit tests with at least 5 test cases per function
