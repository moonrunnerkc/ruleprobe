/** Input validation utilities. */

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
