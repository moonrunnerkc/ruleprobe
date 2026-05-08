/**
 * Types for the GitHub Action entry point.
 *
 * The action supports two modes: drift (default) and verify (legacy).
 * Drift mode compares instruction files against ESLint config and posts
 * results as a PR comment. Verify mode runs the original adherence
 * check pipeline.
 */

import type { DriftResult } from '../drift/types.js';

export type { DriftResult };

/** Action run mode: drift detection (default) or verification (legacy). */
export type ActionMode = 'drift' | 'verify';

/** Inputs for the GitHub Action, parsed from environment variables. */
export interface ActionInputs {
  /** Run mode: drift or verify. */
  mode: ActionMode;
  /** Path to the instruction file (CLAUDE.md, AGENTS.md, .cursorrules). */
  instructionFile: string;
  /** Path to the ESLint config file. Auto-detected if not specified. */
  eslintFile?: string;
  /** Open a follow-up PR with regenerated config when drift is detected. */
  regenerateOnDrift: boolean;
  /** Post drift results as a PR comment. */
  commentOnPr: boolean;
  /** Fail the action if drift is detected. */
  failOnDrift: boolean;
  /** Directory containing code to verify (verify mode only). */
  outputDir?: string;
  /** Agent identifier for verify reports. */
  agent?: string;
  /** Model identifier for verify reports. */
  model?: string;
  /** Report format: text, json, or markdown. */
  format?: string;
  /** Minimum severity to report (verify mode only). */
  severity?: string;
  /** Fail the action on any violation (verify mode only). */
  failOnViolation?: boolean;
  /** Output in reviewdog rdjson format (verify mode only). */
  reviewdogFormat?: boolean;
}

/** Outputs from the drift detection run. */
export interface DriftOutputs {
  /** Number of drift issues detected. */
  driftCount: number;
  /** Whether any drift was detected. */
  hasDrift: boolean;
  /** The full drift result, if drift mode ran. */
  result?: DriftResult;
}

/** Outputs from the verify run (legacy mode). */
export interface VerifyOutputs {
  /** Adherence score as a percentage. */
  score: number;
  /** Number of rules that passed. */
  passed: number;
  /** Number of rules that failed. */
  failed: number;
  /** Total number of rules checked. */
  total: number;
}

/** GitHub context available inside a GitHub Action. */
export interface GitHubContext {
  /** Repository owner/name, e.g. "moonrunnerkc/ruleprobe". */
  repository: string;
  /** GitHub API base URL. */
  apiUrl: string;
  /** PR number, if the event is a pull request. */
  prNumber?: number;
  /** GitHub token for API calls. */
  token: string;
  /** Path to the workspace directory. */
  workspace: string;
  /** Path to the GitHub event JSON file. */
  eventPath: string;
  /** The event name (e.g. "pull_request", "push"). */
  eventName: string;
}

/** Functions that interact with the outside world, injectable for testing. */
export interface ActionDeps {
  /** Run a ruleprobe CLI command and return the exit code. */
  runCommand: (command: string, args: string[]) => Promise<number>;
  /** Get the list of changed files in the current PR. */
  getChangedFiles: (context: GitHubContext) => Promise<string[]>;
  /** Post or update a PR comment. */
  postComment: (context: GitHubContext, prNumber: number, body: string, marker: string) => Promise<void>;
  /** Run a shell command and capture stdout. */
  exec: (command: string, args: string[]) => Promise<{ stdout: string; exitCode: number }>;
  /** Write a string to a file. */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Read a file as a string. */
  readFile: (path: string) => Promise<string>;
  /** Log an info message. */
  info: (message: string) => void;
  /** Log a warning message. */
  warn: (message: string) => void;
  /** Set an action output variable. */
  setOutput: (name: string, value: string) => void;
  /** Set the action exit code. */
  setFailed: (message: string) => void;
}