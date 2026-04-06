/** Input validation utilities for the bookmarks API. */

/**
 * Check whether a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check whether a value looks like a valid URL.
 */
export function isValidUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a value is a string array.
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
