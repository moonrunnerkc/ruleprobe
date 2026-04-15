/**
 * Tests for config-file and git-history rule matchers.
 *
 * Verifies that instruction text is correctly matched to the
 * new config-file and git-history verifier types.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { assembleRules, resetAssemblerCounter } from '../../src/parsers/rule-assembler.js';
import type { ClassifiedStatement } from '../../src/parsers/pipeline-types.js';
import { CONFIG_FILE_MATCHERS } from '../../src/parsers/rule-patterns-config-file.js';
import { GIT_HISTORY_MATCHERS } from '../../src/parsers/rule-patterns-git-history.js';

beforeEach(() => {
  resetAssemblerCounter();
});

function makeStatement(text: string, category: 'WORKFLOW' | 'TOOLING_COMMAND' = 'WORKFLOW'): ClassifiedStatement {
  return {
    text,
    category,
    confidence: 0.9,
    sectionHeader: 'Test Section',
    blockType: 'bullet',
    sectionDepth: 1,
  };
}

describe('config-file matchers: CI rules', () => {
  it('matches "CI must run lint checks"', () => {
    const { rules } = assembleRules([makeStatement('CI must run lint checks')]);
    const ciRule = rules.find((r) => r.id.startsWith('config-ci-lint'));
    expect(ciRule).toBeDefined();
    expect(ciRule?.verifier).toBe('config-file');
    expect(ciRule?.pattern.type).toBe('ci-command-present');
  });

  it('matches "Ensure CI runs tests"', () => {
    const { rules } = assembleRules([makeStatement('Ensure CI runs tests')]);
    const ciRule = rules.find((r) => r.id.startsWith('config-ci-test'));
    expect(ciRule).toBeDefined();
    expect(ciRule?.pattern.type).toBe('ci-command-present');
  });

  it('matches "Set up CI"', () => {
    const { rules } = assembleRules([makeStatement('Set up CI')]);
    const ciRule = rules.find((r) => r.id.startsWith('config-ci-present'));
    expect(ciRule).toBeDefined();
    expect(ciRule?.pattern.type).toBe('ci-config-present');
  });
});

describe('config-file matchers: git hook rules', () => {
  it('matches "Use husky for git hooks"', () => {
    const { rules } = assembleRules([makeStatement('Use husky for git hooks', 'TOOLING_COMMAND')]);
    const hookRule = rules.find((r) => r.id.startsWith('config-husky'));
    expect(hookRule).toBeDefined();
    expect(hookRule?.verifier).toBe('config-file');
    expect(hookRule?.pattern.type).toBe('git-hook-present');
  });
});

describe('config-file matchers: pre-commit rules', () => {
  it('matches "Run npm test before committing"', () => {
    const { rules } = assembleRules([makeStatement('Run npm test before committing')]);
    const rule = rules.find((r) => r.id.startsWith('config-pre-commit-test'));
    expect(rule).toBeDefined();
    expect(rule?.verifier).toBe('config-file');
    expect(rule?.pattern.type).toBe('pre-commit-check');
    expect(rule?.pattern.target).toBe('test');
  });

  it('matches "Run lint before committing"', () => {
    const { rules } = assembleRules([makeStatement('Run lint before committing')]);
    const rule = rules.find((r) => r.id.startsWith('config-pre-commit-lint'));
    expect(rule).toBeDefined();
    expect(rule?.pattern.target).toBe('lint');
  });
});

describe('config-file matchers: environment tools', () => {
  it('matches "Use flox"', () => {
    const { rules } = assembleRules([makeStatement('Use flox', 'TOOLING_COMMAND')]);
    const rule = rules.find((r) => r.id.startsWith('config-env-flox'));
    expect(rule).toBeDefined();
    expect(rule?.verifier).toBe('config-file');
    expect(rule?.pattern.type).toBe('env-tool-present');
    expect(rule?.pattern.target).toBe('flox');
  });

  it('matches "Use nix for development"', () => {
    const { rules } = assembleRules([makeStatement('Use nix shell for development', 'TOOLING_COMMAND')]);
    const rule = rules.find((r) => r.id.startsWith('config-env-nix'));
    expect(rule).toBeDefined();
    expect(rule?.pattern.target).toBe('nix');
  });

  it('matches "Use devcontainer"', () => {
    const { rules } = assembleRules([makeStatement('Use devcontainer', 'TOOLING_COMMAND')]);
    const rule = rules.find((r) => r.id.startsWith('config-env-devcontainer'));
    expect(rule).toBeDefined();
    expect(rule?.pattern.target).toBe('devcontainer');
  });
});

describe('git-history matchers', () => {
  it('matches "Use conventional commits"', () => {
    const { rules } = assembleRules([makeStatement('Use conventional commits')]);
    const rule = rules.find((r) => r.id.startsWith('git-conventional-commits'));
    expect(rule).toBeDefined();
    expect(rule?.verifier).toBe('git-history');
    expect(rule?.category).toBe('workflow');
    expect(rule?.pattern.type).toBe('conventional-commits');
  });

  it('matches "Prefix commits with [AI]"', () => {
    const { rules } = assembleRules([makeStatement('Prefix commits with [AI]')]);
    const rule = rules.find((r) => r.id.startsWith('git-commit-prefix'));
    expect(rule).toBeDefined();
    expect(rule?.verifier).toBe('git-history');
    expect(rule?.pattern.type).toBe('commit-message-prefix');
    expect(rule?.pattern.target).toBe('[AI]');
  });

  it('matches "Sign all commits"', () => {
    const { rules } = assembleRules([makeStatement('Sign all commits')]);
    const rule = rules.find((r) => r.id.startsWith('git-signed-commits'));
    expect(rule).toBeDefined();
    expect(rule?.verifier).toBe('git-history');
    expect(rule?.pattern.type).toBe('signed-commits');
  });

  it('matches "Branch names must follow feature/xxx pattern"', () => {
    const { rules } = assembleRules([
      makeStatement('Branch naming convention: feature/description'),
    ]);
    const rule = rules.find((r) => r.id.startsWith('git-branch-naming'));
    expect(rule).toBeDefined();
    expect(rule?.pattern.type).toBe('branch-naming');
  });
});

describe('agent-behavior classification', () => {
  it('classifies "Be terse" as agent-behavior category', () => {
    const stmt: ClassifiedStatement = {
      text: 'Be terse in your responses',
      category: 'AGENT_BEHAVIOR',
      confidence: 0.85,
      sectionHeader: 'Communication',
      blockType: 'bullet',
      sectionDepth: 1,
    };
    const { rules } = assembleRules([stmt]);
    const rule = rules.find((r) => r.category === 'agent-behavior');
    expect(rule).toBeDefined();
    expect(rule?.id).toContain('agent-behavior');
  });

  it('classifies "don\'t explain unless asked" as agent-behavior', () => {
    const stmt: ClassifiedStatement = {
      text: "Don't explain unless asked to",
      category: 'AGENT_BEHAVIOR',
      confidence: 0.85,
      sectionHeader: 'Communication',
      blockType: 'bullet',
      sectionDepth: 1,
    };
    const { rules } = assembleRules([stmt]);
    const rule = rules.find((r) => r.category === 'agent-behavior');
    expect(rule).toBeDefined();
  });
});

describe('config-file matchers: regex patterns match correctly', () => {
  it('all config-file matchers have valid patterns', () => {
    for (const matcher of CONFIG_FILE_MATCHERS) {
      expect(matcher.id).toBeTruthy();
      expect(matcher.patterns.length).toBeGreaterThan(0);
      expect(matcher.verifier).toBe('config-file');
      expect(['workflow', 'tooling']).toContain(matcher.category);
    }
  });

  it('all git-history matchers have valid patterns', () => {
    for (const matcher of GIT_HISTORY_MATCHERS) {
      expect(matcher.id).toBeTruthy();
      expect(matcher.patterns.length).toBeGreaterThan(0);
      expect(matcher.verifier).toBe('git-history');
      expect(matcher.category).toBe('workflow');
    }
  });
});
