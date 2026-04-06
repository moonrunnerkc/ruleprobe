/** ID generation utility. */

let counter = 0;

/**
 * Generate a unique identifier for a bookmark.
 */
export function createId(): string {
  counter += 1;
  return `bk_${Date.now()}_${counter}`;
}
