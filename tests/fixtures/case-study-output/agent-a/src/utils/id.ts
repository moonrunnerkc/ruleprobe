/** ID generation utility. */

let counter = 0;

/**
 * Generate a unique ID string.
 *
 * Uses a timestamp and incrementing counter for uniqueness.
 */
export function createId(): string {
  counter += 1;
  return `bk_${Date.now()}_${counter}`;
}
