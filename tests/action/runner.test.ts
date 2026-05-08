/**
 * Tests for the action runner.
 *
 * Tests the orchestration logic with injected dependencies, confirming
 * that the right commands run based on inputs and PR context.
 */

import { describe, it, expect, vi } from 'vitest';
import { runAction } from '../../src/action/runner.js';
import type { ActionInputs, ActionDeps, GitHubContext } from '../../src/action/types.js';

function makeContext(overrides?: Partial<GitHubContext>): GitHubContext {
  return {
    repository: 'owner/repo',
    apiUrl: 'https://api.github.com',
    prNumber: 42,
    token: 'test-token',
    workspace: '/home/runner/work/repo',
    eventPath: '/home/runner/work/_temp/event.json',
    eventName: 'pull_request',
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<ActionDeps>): ActionDeps {
  return {
    runCommand: vi.fn().mockResolvedValue(0),
    getChangedFiles: vi.fn().mockResolvedValue(['CLAUDE.md', '.eslintrc.json']),
    postComment: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({ stdout: '', exitCode: 0 }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    info: vi.fn(),
    warn: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    ...overrides,
  };
}

function makeInputs(overrides?: Partial<ActionInputs>): ActionInputs {
  return {
    mode: 'drift',
    instructionFile: 'CLAUDE.md',
    eslintFile: '.eslintrc.json',
    regenerateOnDrift: false,
    commentOnPr: true,
    failOnDrift: false,
    ...overrides,
  };
}

describe('runAction (drift mode)', () => {
  it('skips when no relevant files changed', async () => {
    const deps = makeDeps({
      getChangedFiles: vi.fn().mockResolvedValue(['src/index.ts', 'package.json']),
    });

    await runAction(makeInputs(), makeContext(), deps);

    expect(deps.runCommand).not.toHaveBeenCalled();
    expect(deps.postComment).not.toHaveBeenCalled();
    expect(deps.info).toHaveBeenCalledWith(
      expect.stringContaining('skipping'),
    );
  });

  it('runs drift when CLAUDE.md is changed', async () => {
    const deps = makeDeps({
      runCommand: vi.fn().mockResolvedValue(0),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(makeInputs(), makeContext(), deps);

    expect(deps.runCommand).toHaveBeenCalledWith(
      expect.stringContaining('ruleprobe'),
      expect.arrayContaining(['drift']),
    );
  });

  it('posts a PR comment when drift runs and commentOnPr is true', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(makeInputs({ commentOnPr: true }), makeContext(), deps);

    expect(deps.postComment).toHaveBeenCalledWith(
      expect.any(Object),
      42,
      expect.stringContaining('ruleprobe-drift'),
      expect.any(String),
    );
  });

  it('skips PR comment when commentOnPr is false', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(makeInputs({ commentOnPr: false }), makeContext(), deps);

    expect(deps.postComment).not.toHaveBeenCalled();
  });

  it('skips PR comment when not in a PR context', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });
    const context = makeContext({ prNumber: undefined, eventName: 'push' });

    await runAction(makeInputs({ commentOnPr: true }), context, deps);

    expect(deps.postComment).not.toHaveBeenCalled();
  });

  it('sets drift-count and has-drift outputs', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [
          { kind: 'md-only', ruleName: 'no-any', message: 'missing' },
        ],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: true,
      })),
    });

    await runAction(makeInputs(), makeContext(), deps);

    expect(deps.setOutput).toHaveBeenCalledWith('drift-count', '1');
    expect(deps.setOutput).toHaveBeenCalledWith('has-drift', 'true');
  });

  it('fails the action when drift detected and failOnDrift is true', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [
          { kind: 'md-only', ruleName: 'no-any', message: 'missing' },
        ],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: true,
      })),
    });

    await runAction(makeInputs({ failOnDrift: true }), makeContext(), deps);

    expect(deps.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('drift'),
    );
  });

  it('does not fail when no drift and failOnDrift is true', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(makeInputs({ failOnDrift: true }), makeContext(), deps);

    expect(deps.setFailed).not.toHaveBeenCalled();
  });

  it('auto-detects eslint config when eslintFile is not specified', async () => {
    const deps = makeDeps({
      getChangedFiles: vi.fn().mockResolvedValue(['CLAUDE.md', '.eslintrc.json']),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(
      makeInputs({ eslintFile: undefined }),
      makeContext(),
      deps,
    );

    expect(deps.runCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['.eslintrc.json']),
    );
  });

  it('regenerates config when drift detected and regenerateOnDrift is true', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [
          { kind: 'md-only', ruleName: 'no-any', message: 'missing' },
        ],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: true,
      })),
    });

    await runAction(
      makeInputs({ regenerateOnDrift: true }),
      makeContext(),
      deps,
    );

    // Should call exec to run lint-config, git checkout, etc.
    expect(deps.exec).toHaveBeenCalled();
  });

  it('does not regenerate when no drift even if regenerateOnDrift is true', async () => {
    const deps = makeDeps({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        items: [],
        mdFile: 'CLAUDE.md',
        eslintFile: '.eslintrc.json',
        hasDrift: false,
      })),
    });

    await runAction(
      makeInputs({ regenerateOnDrift: true }),
      makeContext(),
      deps,
    );

    // exec should not be called for git/gh operations
    const execCalls = (deps.exec as ReturnType<typeof vi.fn>).mock.calls;
    const gitCalls = execCalls.filter((call: string[]) =>
      call[0] === 'git' || call[0] === 'gh',
    );
    expect(gitCalls.length).toBe(0);
  });
});

describe('runAction (verify mode)', () => {
  it('runs verify command in verify mode', async () => {
    const deps = makeDeps({
      runCommand: vi.fn().mockResolvedValue(0),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        summary: { adherenceScore: 100, passed: 5, failed: 0, totalRules: 5 },
      })),
    });

    await runAction(
      makeInputs({ mode: 'verify', outputDir: 'src' }),
      makeContext(),
      deps,
    );

    expect(deps.runCommand).toHaveBeenCalledWith(
      expect.stringContaining('ruleprobe'),
      expect.arrayContaining(['verify']),
    );
  });

  it('sets verify outputs in verify mode', async () => {
    const deps = makeDeps({
      runCommand: vi.fn().mockResolvedValue(0),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        summary: { adherenceScore: 80, passed: 4, failed: 1, totalRules: 5 },
      })),
    });

    await runAction(
      makeInputs({ mode: 'verify', outputDir: 'src' }),
      makeContext(),
      deps,
    );

    expect(deps.setOutput).toHaveBeenCalledWith('score', '80');
    expect(deps.setOutput).toHaveBeenCalledWith('passed', '4');
    expect(deps.setOutput).toHaveBeenCalledWith('failed', '1');
    expect(deps.setOutput).toHaveBeenCalledWith('total', '5');
  });
});