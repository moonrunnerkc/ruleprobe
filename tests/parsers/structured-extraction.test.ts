/**
 * Tests for structured extraction: section context and qualifier detection
 * carried through to extracted rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractRules, resetRuleCounter } from '../../src/parsers/rule-extractor.js';
import type { MarkdownSection } from '../../src/types.js';

beforeEach(() => {
  resetRuleCounter();
});

describe('structured extraction: section context', () => {
  it('attaches section header to extracted rules', () => {
    const sections: MarkdownSection[] = [{
      header: 'Code Style',
      depth: 2,
      body: '- Use camelCase for variables',
      lines: ['- Use camelCase for variables'],
    }];

    const { rules } = extractRules(sections);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]!.section).toBe('Code Style');
  });

  it('leaves section undefined for rules in headerless sections', () => {
    const sections: MarkdownSection[] = [{
      header: '',
      depth: 0,
      body: '- Use camelCase for variables',
      lines: ['- Use camelCase for variables'],
    }];

    const { rules } = extractRules(sections);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]!.section).toBeUndefined();
  });

  it('tracks different sections for rules from different headers', () => {
    const sections: MarkdownSection[] = [
      {
        header: 'Naming',
        depth: 2,
        body: '- Use camelCase for variables',
        lines: ['- Use camelCase for variables'],
      },
      {
        header: 'Forbidden Patterns',
        depth: 2,
        body: '- No console.log in production',
        lines: ['- No console.log in production'],
      },
    ];

    const { rules } = extractRules(sections);
    const namingRule = rules.find((r) => r.category === 'naming');
    const forbiddenRule = rules.find((r) => r.category === 'forbidden-pattern');
    expect(namingRule?.section).toBe('Naming');
    expect(forbiddenRule?.section).toBe('Forbidden Patterns');
  });
});

describe('structured extraction: qualifier detection', () => {
  it('sets qualifier to never for "No console.log"', () => {
    const sections: MarkdownSection[] = [{
      header: 'Rules',
      depth: 2,
      body: '- No console.log in production',
      lines: ['- No console.log in production'],
    }];

    const { rules } = extractRules(sections);
    const rule = rules.find((r) => r.pattern.type === 'no-console-log');
    expect(rule?.qualifier).toBe('never');
  });

  it('sets qualifier to always for "Use camelCase"', () => {
    const sections: MarkdownSection[] = [{
      header: 'Rules',
      depth: 2,
      body: '- Use camelCase for variables',
      lines: ['- Use camelCase for variables'],
    }];

    const { rules } = extractRules(sections);
    expect(rules[0]!.qualifier).toBe('always');
  });

  it('sets qualifier to never for "Never use any types"', () => {
    const sections: MarkdownSection[] = [{
      header: 'Rules',
      depth: 2,
      body: '- Never use any types',
      lines: ['- Never use any types'],
    }];

    const { rules } = extractRules(sections);
    const rule = rules.find((r) => r.pattern.type === 'no-any');
    expect(rule?.qualifier).toBe('never');
  });

  it('sets qualifier to always for "Always use named exports"', () => {
    const sections: MarkdownSection[] = [{
      header: 'Rules',
      depth: 2,
      body: '- Always use named exports',
      lines: ['- Always use named exports'],
    }];

    const { rules } = extractRules(sections);
    const rule = rules.find((r) => r.pattern.type === 'named-exports-only');
    expect(rule?.qualifier).toBe('always');
  });
});
