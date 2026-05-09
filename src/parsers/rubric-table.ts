/**
 * Static rubric table for deterministic decomposition.
 *
 * Maps families of subjective phrases ("write clean code", "keep it
 * simple", etc.) to weighted proxy checks that already exist in the
 * verifier engines. Adding a new rubric: append an entry below; weights
 * within a single rubric should sum to 1.0.
 */

import type { RuleCategory, VerifierType, VerificationPattern } from '../types.js';

/** Soft cap on function length used by "clean code" / "simple" rubrics. */
const RUBRIC_MAX_FUNCTION_LENGTH = '50';
/** Soft cap on parameter count used by "clean code" / "simple" rubrics. */
const RUBRIC_MAX_PARAMS = '4';
/** Soft cap on file length used by "small files" / "modular" rubrics. */
const RUBRIC_MAX_FILE_LENGTH = '300';

/** A single concrete proxy check inside a deterministic rubric. */
export interface DeterministicRubricCheck {
  /** Stable suffix used to build the rule id. */
  idSuffix: string;
  /** Human-readable description of what this proxy actually measures. */
  description: string;
  /** Weight (0-1) within the rubric. Weights in a rubric should sum to 1. */
  weight: number;
  /** Verifier engine that handles this check. */
  verifier: VerifierType;
  /** Pattern definition that the verifier knows how to evaluate. */
  pattern: VerificationPattern;
}

/** A single deterministic rubric: phrase → set of proxy checks. */
export interface DeterministicRubric {
  /** Human-readable name for the rubric. */
  name: string;
  /** Category used for every rule produced from this rubric. */
  category: RuleCategory;
  /** Phrases that activate this rubric. Matched case-insensitively. */
  phrases: RegExp[];
  /** Proxy checks. Together they approximate the subjective phrase. */
  checks: DeterministicRubricCheck[];
}

/**
 * Deterministic rubric table.
 *
 * Each entry maps a family of subjective phrases to weighted proxy
 * checks. The weights are intentional: "clean code" cares more about
 * function size than about magic numbers, so max-function-length gets
 * the largest share. Weights are referenced as Rule.rubricWeight so
 * reporters can produce a partial adherence score.
 */
export const RUBRIC_TABLE: readonly DeterministicRubric[] = [
  {
    name: 'clean-code',
    category: 'code-style',
    phrases: [
      /\bwrite\s+clean\s+code\b/i,
      /\bclean\s+code\b/i,
      /\bcode\s+should\s+be\s+clean\b/i,
      /\bkeep\s+the\s+code\s+clean\b/i,
    ],
    checks: [
      {
        idSuffix: 'max-function-length',
        description: 'Functions should stay short enough to read at a glance',
        weight: 0.35,
        verifier: 'ast',
        pattern: { type: 'max-function-length', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_FUNCTION_LENGTH, scope: 'file' },
      },
      {
        idSuffix: 'no-magic-numbers',
        description: 'Avoid unexplained numeric literals; use named constants',
        weight: 0.20,
        verifier: 'ast',
        pattern: { type: 'no-magic-numbers', target: '*.{ts,tsx,js,jsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'no-nested-ternary',
        description: 'Avoid nested ternaries; use early returns',
        weight: 0.15,
        verifier: 'ast',
        pattern: { type: 'no-nested-ternary', target: '*.{ts,tsx,js,jsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'no-else-after-return',
        description: 'Drop the else branch when the if-branch returns',
        weight: 0.10,
        verifier: 'ast',
        pattern: { type: 'no-else-after-return', target: '*.{ts,tsx,js,jsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'jsdoc-required',
        description: 'Public symbols carry a JSDoc explaining intent',
        weight: 0.10,
        verifier: 'ast',
        pattern: { type: 'jsdoc-required', target: '*.{ts,tsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'max-params',
        description: 'Functions accept a small, manageable number of parameters',
        weight: 0.10,
        verifier: 'ast',
        pattern: { type: 'max-params', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_PARAMS, scope: 'file' },
      },
    ],
  },
  {
    name: 'keep-it-simple',
    category: 'code-style',
    phrases: [
      /\bkeep\s+it\s+simple\b/i,
      /\bkiss\b/i,
      /\bbe\s+simple\b/i,
      /\bsimple\s+code\b/i,
      /\bavoid\s+complexity\b/i,
      /\bdon'?t\s+over[-\s]?engineer\b/i,
    ],
    checks: [
      {
        idSuffix: 'max-function-length',
        description: 'Simple functions stay short',
        weight: 0.40,
        verifier: 'ast',
        pattern: { type: 'max-function-length', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_FUNCTION_LENGTH, scope: 'file' },
      },
      {
        idSuffix: 'no-nested-ternary',
        description: 'Avoid nested ternaries',
        weight: 0.25,
        verifier: 'ast',
        pattern: { type: 'no-nested-ternary', target: '*.{ts,tsx,js,jsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'max-params',
        description: 'Few parameters',
        weight: 0.20,
        verifier: 'ast',
        pattern: { type: 'max-params', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_PARAMS, scope: 'file' },
      },
      {
        idSuffix: 'no-else-after-return',
        description: 'Flatten control flow with early returns',
        weight: 0.15,
        verifier: 'ast',
        pattern: { type: 'no-else-after-return', target: '*.{ts,tsx,js,jsx}', expected: true, scope: 'file' },
      },
    ],
  },
  {
    name: 'modular',
    category: 'structure',
    phrases: [
      /\bkeep\s+files\s+small\b/i,
      /\bsmall\s+files\b/i,
      /\bmodular\s+code\b/i,
      /\bmake\s+it\s+modular\b/i,
      /\bdecompose\s+large\s+files\b/i,
    ],
    checks: [
      {
        idSuffix: 'max-file-length',
        description: 'Files stay under a soft line limit',
        weight: 0.50,
        verifier: 'filesystem',
        pattern: { type: 'max-file-length', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_FILE_LENGTH, scope: 'file' },
      },
      {
        idSuffix: 'max-function-length',
        description: 'Functions stay short within those files',
        weight: 0.30,
        verifier: 'ast',
        pattern: { type: 'max-function-length', target: '*.{ts,tsx,js,jsx}', expected: RUBRIC_MAX_FUNCTION_LENGTH, scope: 'file' },
      },
      {
        idSuffix: 'no-barrel-files',
        description: 'Avoid catch-all barrel exports',
        weight: 0.20,
        verifier: 'ast',
        pattern: { type: 'no-barrel-files', target: '*.{ts,tsx}', expected: true, scope: 'project' },
      },
    ],
  },
  {
    name: 'be-explicit',
    category: 'type-safety',
    phrases: [
      /\bbe\s+explicit\b/i,
      /\bavoid\s+implicit\s+any\b/i,
      /\bno\s+implicit\s+behavior\b/i,
      /\btype\s+everything\b/i,
    ],
    checks: [
      {
        idSuffix: 'no-any',
        description: 'No use of the any type',
        weight: 0.50,
        verifier: 'ast',
        pattern: { type: 'no-any', target: '*.{ts,tsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'no-non-null-assertions',
        description: 'No non-null assertion operator',
        weight: 0.25,
        verifier: 'ast',
        pattern: { type: 'no-non-null-assertions', target: '*.{ts,tsx}', expected: true, scope: 'file' },
      },
      {
        idSuffix: 'no-type-assertions',
        description: 'No unchecked type assertions',
        weight: 0.25,
        verifier: 'ast',
        pattern: { type: 'no-type-assertions', target: '*.{ts,tsx}', expected: true, scope: 'file' },
      },
    ],
  },
];
