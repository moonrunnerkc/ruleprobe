// Tests for the Markdown instruction file parser.
// Covers section splitting, header detection, and flattenSectionLines.

import { describe, it, expect } from 'vitest';
import { parseMarkdown, flattenSectionLines } from '../../src/parsers/markdown-parser.js';

describe('parseMarkdown', () => {
  it('splits content into sections by headers', () => {
    const md = `# Header One

Some content here.
More content.

## Header Two

Second section content.

### Header Three

Third level content.
`;

    const sections = parseMarkdown(md);

    expect(sections).toHaveLength(3);
    expect(sections[0]?.header).toBe('Header One');
    expect(sections[0]?.depth).toBe(1);
    expect(sections[1]?.header).toBe('Header Two');
    expect(sections[1]?.depth).toBe(2);
    expect(sections[2]?.header).toBe('Header Three');
    expect(sections[2]?.depth).toBe(3);
  });

  it('captures body content under each header', () => {
    const md = `# Code Standards

- Use camelCase for variables
- No any types
- Named exports only
`;

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(1);

    const section = sections[0]!;
    expect(section.body).toContain('Use camelCase for variables');
    expect(section.body).toContain('No any types');
    expect(section.body).toContain('Named exports only');
  });

  it('strips empty lines from the lines array but preserves them in body', () => {
    const md = `# Section

Line one.

Line two.

Line three.
`;

    const sections = parseMarkdown(md);
    const section = sections[0]!;

    // Lines array has no empties
    expect(section.lines).toEqual(['Line one.', 'Line two.', 'Line three.']);

    // Body retains structure (but is trimmed at edges)
    expect(section.body).toContain('\n');
  });

  it('captures content before first header as depth-0 section', () => {
    const md = `This is a preamble with no header.

# Actual Section

Section content.
`;

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.header).toBe('');
    expect(sections[0]?.depth).toBe(0);
    expect(sections[0]?.lines).toContain('This is a preamble with no header.');
  });

  it('handles deeply nested headers up to h6', () => {
    const md = `# H1
## H2
### H3
#### H4
##### H5
###### H6
`;

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(6);
    expect(sections[0]?.depth).toBe(1);
    expect(sections[1]?.depth).toBe(2);
    expect(sections[2]?.depth).toBe(3);
    expect(sections[3]?.depth).toBe(4);
    expect(sections[4]?.depth).toBe(5);
    expect(sections[5]?.depth).toBe(6);
  });

  it('handles empty document', () => {
    const sections = parseMarkdown('');
    expect(sections).toHaveLength(0);
  });

  it('handles document with only headers and no body', () => {
    const md = `# First
## Second
### Third
`;

    const sections = parseMarkdown(md);
    // Each header starts a section; first two have empty bodies
    expect(sections).toHaveLength(3);
    expect(sections[0]?.lines).toHaveLength(0);
    expect(sections[1]?.lines).toHaveLength(0);
    expect(sections[2]?.lines).toHaveLength(0);
  });

  it('preserves list items with markers in lines array', () => {
    const md = `# Rules

- Use camelCase
- No default exports
* PascalCase for types
1. Named exports only
`;

    const sections = parseMarkdown(md);
    const lines = sections[0]!.lines;
    expect(lines).toContain('- Use camelCase');
    expect(lines).toContain('- No default exports');
    expect(lines).toContain('* PascalCase for types');
    expect(lines).toContain('1. Named exports only');
  });

  it('parses a realistic CLAUDE.md structure', () => {
    const md = `# CLAUDE.md

## Role

You are a senior TypeScript engineer.

## Code Standards

- TypeScript strict mode, no any types
- Named exports only, no default exports
- File names: kebab-case
- Variable and function names: camelCase

## Testing

- Test files must be named *.test.ts
- All files must have tests

## Architecture

- DRY, SOLID, explicit boundaries
- Follow best practices
`;

    const sections = parseMarkdown(md);

    // Should have 5 sections: CLAUDE.md, Role, Code Standards, Testing, Architecture
    expect(sections).toHaveLength(5);

    const codeStandards = sections.find((s) => s.header === 'Code Standards');
    expect(codeStandards).toBeDefined();
    expect(codeStandards!.lines).toHaveLength(4);

    const testing = sections.find((s) => s.header === 'Testing');
    expect(testing).toBeDefined();
    expect(testing!.lines).toHaveLength(2);
  });
});

describe('flattenSectionLines', () => {
  it('returns all non-empty lines across all sections', () => {
    const md = `# Section A

Line A1.
Line A2.

## Section B

Line B1.
`;

    const sections = parseMarkdown(md);
    const flat = flattenSectionLines(sections);

    expect(flat).toEqual(['Line A1.', 'Line A2.', 'Line B1.']);
  });

  it('returns empty array for empty document', () => {
    const sections = parseMarkdown('');
    expect(flattenSectionLines(sections)).toEqual([]);
  });
});
