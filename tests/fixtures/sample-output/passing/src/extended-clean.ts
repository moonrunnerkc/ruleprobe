/**
 * Fixture with no violations of extended AST checks.
 * Uses proper patterns for all checked rules.
 */

import { join } from 'node:path';

/** Handle a risky JSON parse with proper error handling. */
export function safeOperation(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    throw new Error(`Parse failed: ${message}`);
  }
}

/** Status represented as a union type instead of an enum. */
export type Status = 'active' | 'inactive';

/** Safe type narrowing instead of assertions. */
export function safeCast(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string');
  }
  return value;
}

/** Early return pattern instead of else after return. */
export function classifyNumber(x: number): string {
  if (x > 0) {
    return 'positive';
  }
  return 'non-positive';
}

const DAYS_IN_YEAR = 365;
const ANSWER = 42;

/** Named constants instead of magic numbers. */
export function calculateDays(years: number): number {
  return years * DAYS_IN_YEAR + ANSWER;
}

/** Named import instead of namespace import. */
export function buildPath(): string {
  return join('a', 'b');
}
