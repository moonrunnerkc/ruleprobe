/**
 * Tests for qualifier detection on real instruction file text.
 *
 * Each test case uses text from or modeled on the 8-repo audit
 * (next.js, langchain, excalidraw, zed, elasticsearch, codex, cline, PostHog).
 */

import { describe, it, expect } from 'vitest';
import { detectQualifier } from '../../src/parsers/qualifier-detector.js';

describe('detectQualifier', () => {
  describe('always qualifier', () => {
    it('detects "always use" phrasing', () => {
      expect(detectQualifier('Always use named exports')).toBe('always');
    });

    it('detects "must" phrasing', () => {
      expect(detectQualifier('Code must be formatted with Prettier')).toBe('always');
    });

    it('detects "required" phrasing', () => {
      expect(detectQualifier('JSDoc comments are required on all public functions')).toBe('always');
    });

    it('detects "ensure" phrasing', () => {
      expect(detectQualifier('Ensure all tests pass before merging')).toBe('always');
    });

    it('defaults to always when no qualifier keyword found', () => {
      expect(detectQualifier('Use camelCase for variables')).toBe('always');
    });
  });

  describe('prefer qualifier', () => {
    it('detects "prefer" keyword', () => {
      expect(detectQualifier('Prefer functional components over class components')).toBe('prefer');
    });

    it('detects "favor" keyword', () => {
      expect(detectQualifier('Favor composition over inheritance')).toBe('prefer');
    });

    it('detects "default to" phrasing', () => {
      expect(detectQualifier('Default to strict TypeScript settings')).toBe('prefer');
    });

    it('detects "instead of" phrasing', () => {
      expect(detectQualifier('Use interface instead of type for object shapes')).toBe('prefer');
    });
  });

  describe('when-possible qualifier', () => {
    it('detects "when possible" phrasing', () => {
      expect(detectQualifier('Use const when possible')).toBe('when-possible');
    });

    it('detects "where feasible" phrasing', () => {
      expect(detectQualifier('Avoid side effects in reducers where feasible')).toBe('when-possible');
    });

    it('detects "if practical" phrasing', () => {
      expect(detectQualifier('Keep files under 200 lines if practical')).toBe('when-possible');
    });

    it('detects "ideally" keyword', () => {
      expect(detectQualifier('Ideally, tests should run in under 10 seconds')).toBe('when-possible');
    });

    it('detects "whenever possible" phrasing', () => {
      expect(detectQualifier('Use TypeScript whenever possible')).toBe('when-possible');
    });
  });

  describe('avoid-unless qualifier', () => {
    it('detects "avoid unless" phrasing', () => {
      expect(detectQualifier('Avoid any types unless absolutely necessary')).toBe('avoid-unless');
    });

    it('detects "only when necessary" phrasing', () => {
      expect(detectQualifier('Use type assertions only when necessary')).toBe('avoid-unless');
    });

    it('detects "except when" phrasing', () => {
      expect(detectQualifier('No console.log except when debugging')).toBe('avoid-unless');
    });

    it('detects "unless performance requires" phrasing', () => {
      expect(detectQualifier('Avoid mutation unless performance requires it')).toBe('avoid-unless');
    });
  });

  describe('try-to qualifier', () => {
    it('detects "try to" phrasing', () => {
      expect(detectQualifier('Try to keep files under 300 lines')).toBe('try-to');
    });

    it('detects "aim for" phrasing', () => {
      expect(detectQualifier('Aim for 80% test coverage')).toBe('try-to');
    });

    it('detects "strive to" phrasing', () => {
      expect(detectQualifier('Strive to write self-documenting code')).toBe('try-to');
    });

    it('detects "should generally" phrasing', () => {
      expect(detectQualifier('Functions should generally be under 50 lines')).toBe('try-to');
    });
  });

  describe('never qualifier', () => {
    it('detects "never" keyword', () => {
      expect(detectQualifier('Never use any types')).toBe('never');
    });

    it('detects "do not" phrasing', () => {
      expect(detectQualifier('Do not use default exports')).toBe('never');
    });

    it('detects "don\'t" phrasing', () => {
      expect(detectQualifier("Don't use console.log in production")).toBe('never');
    });

    it('detects "must not" phrasing', () => {
      expect(detectQualifier('Tests must not have side effects')).toBe('never');
    });

    it('detects "forbidden" keyword', () => {
      expect(detectQualifier('Any type usage is forbidden')).toBe('never');
    });

    it('detects "not allowed" phrasing', () => {
      expect(detectQualifier('Default exports are not allowed')).toBe('never');
    });

    it('detects "no X" pattern', () => {
      expect(detectQualifier('No console.log in production code')).toBe('never');
    });
  });

  describe('priority ordering', () => {
    it('avoid-unless beats never when both present', () => {
      // "avoid unless" is more specific than bare "avoid"
      expect(detectQualifier('Avoid any types unless absolutely necessary')).toBe('avoid-unless');
    });

    it('when-possible beats prefer', () => {
      expect(detectQualifier('Prefer const when possible')).toBe('when-possible');
    });

    it('try-to beats always for "should generally"', () => {
      expect(detectQualifier('Should generally use named exports')).toBe('try-to');
    });
  });
});
