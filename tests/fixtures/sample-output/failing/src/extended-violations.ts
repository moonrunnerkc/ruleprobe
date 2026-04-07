/**
 * Fixture with violations for extended AST checks.
 * Each function/block demonstrates a specific violation.
 */

// Empty catch block violation
export function riskyOperation(): void {
  try {
    JSON.parse('invalid');
  } catch (e) {
    // empty catch: violation
  }
}

// Enum violation
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// Type assertion violation
export function unsafeCast(value: unknown): string {
  return value as string;
}

// Non-null assertion violation
export function dangerousAccess(arr: string[] | undefined): string {
  return arr![0]!;
}

// Throw non-Error violation
export function badThrow(): never {
  throw 'something went wrong';
}

// Console.warn/error violation
export function logStuff(): void {
  console.warn('warning');
  console.error('error');
}

// Nested ternary violation
export function nestedTernary(a: number): string {
  return a > 10 ? a > 20 ? 'high' : 'medium' : 'low';
}

// Magic number violation
export function magicMath(input: number): number {
  return input * 42 + 365;
}

// Else after return violation
export function elseAfterReturn(x: number): string {
  if (x > 0) {
    return 'positive';
  } else {
    return 'non-positive';
  }
}

// Namespace import violation
import * as path from 'node:path';

export function usePath(): string {
  return path.join('a', 'b');
}

// Too many parameters violation
export function tooManyParams(a: string, b: string, c: number): string {
  return `${a}-${b}-${c}`;
}
