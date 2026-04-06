/**
 * Email and input validation utilities.
 */

/** Standard email pattern check. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address format.
 *
 * @param email - The email string to validate
 * @returns True if the email matches a valid format
 */
export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/**
 * Validate that a string is non-empty after trimming.
 *
 * @param value - The string to check
 * @returns True if the string has content
 */
export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
