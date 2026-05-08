/**
 * Tests for the regenerate module.
 *
 * Validates that regeneration produces the correct branch name,
 * commit message, and PR title from the instruction file path.
 * The actual git/gh operations are tested via the runner integration
 * tests with injected deps.
 */

import { describe, it, expect } from 'vitest';
import { branchNameFor, commitMessageFor, prTitleFor } from '../../src/action/regenerate.js';

describe('branchNameFor', () => {
  it('produces a deterministic branch name from instruction file', () => {
    const branch = branchNameFor('CLAUDE.md');
    expect(branch).toMatch(/^ruleprobe\/sync-[a-f0-9]+$/);
  });

  it('produces different branch names for different files', () => {
    expect(branchNameFor('CLAUDE.md')).not.toBe(branchNameFor('AGENTS.md'));
  });

  it('produces the same branch name for the same file', () => {
    expect(branchNameFor('CLAUDE.md')).toBe(branchNameFor('CLAUDE.md'));
  });

  it('handles paths with directories', () => {
    const branch = branchNameFor('packages/app/CLAUDE.md');
    expect(branch).toMatch(/^ruleprobe\/sync-[a-f0-9]+$/);
  });
});

describe('commitMessageFor', () => {
  it('includes the instruction file name', () => {
    const msg = commitMessageFor('CLAUDE.md');
    expect(msg).toContain('CLAUDE.md');
  });

  it('starts with chore:', () => {
    const msg = commitMessageFor('CLAUDE.md');
    expect(msg).toMatch(/^chore:/);
  });

  it('includes "sync eslint config"', () => {
    const msg = commitMessageFor('CLAUDE.md');
    expect(msg).toContain('sync eslint config');
  });
});

describe('prTitleFor', () => {
  it('includes the instruction file name', () => {
    const title = prTitleFor('CLAUDE.md');
    expect(title).toContain('CLAUDE.md');
  });

  it('mentions drift sync', () => {
    const title = prTitleFor('CLAUDE.md');
    expect(title).toMatch(/drift/i);
  });
});