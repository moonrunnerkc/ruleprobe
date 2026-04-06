/** Bookmark route handlers and storage layer. */

import { createId } from '../utils/id.js';
import { isNonEmptyString, isValidUrl } from '../middleware/validation.js';
import type {
  Bookmark,
  CreateBookmarkRequest,
  BookmarkListQuery,
  ApiError,
} from '../types.js';

const bookmarks: Bookmark[] = [];

const max_bookmarks_per_page = 50;

/**
 * Validate the create bookmark request body.
 */
function validateCreateRequest(
  body: Record<string, unknown>,
): CreateBookmarkRequest | ApiError {
  if (!isNonEmptyString(body['url'])) {
    return { status: 400, message: 'Missing required field: url' };
  }

  if (!isNonEmptyString(body['title'])) {
    return { status: 400, message: 'Missing required field: title' };
  }

  if (!isValidUrl(body['url'])) {
    return { status: 400, message: 'Invalid URL format' };
  }

  const tags: string[] = [];
  if (Array.isArray(body['tags'])) {
    for (const tag of body['tags']) {
      if (typeof tag === 'string') {
        tags.push(tag.trim().toLowerCase());
      }
    }
  }

  return {
    url: body['url'] as string,
    title: body['title'] as string,
    tags,
  };
}

/**
 * Create a new bookmark.
 *
 * Validates input and returns the created bookmark with a generated ID.
 * Returns an ApiError if the input is invalid.
 */
export function createBookmark(
  body: Record<string, unknown>,
): Bookmark | ApiError {
  const validated = validateCreateRequest(body);

  if ('status' in validated) {
    return validated;
  }

  const bookmark: Bookmark = {
    id: createId(),
    url: validated.url,
    title: validated.title,
    tags: validated.tags ?? [],
    createdAt: new Date().toISOString(),
  };

  bookmarks.push(bookmark);
  return bookmark;
}

/**
 * Parse and validate the list query parameters.
 */
function parseListQuery(
  params: Record<string, unknown>,
): BookmarkListQuery {
  const query: BookmarkListQuery = {};

  if (typeof params['tag'] === 'string' && params['tag'].length > 0) {
    query.tag = params['tag'].toLowerCase();
  }

  if (typeof params['limit'] === 'number' && params['limit'] > 0) {
    query.limit = Math.min(params['limit'], max_bookmarks_per_page);
  } else if (typeof params['limit'] === 'string') {
    const parsed = parseInt(params['limit'], 10);
    if (!isNaN(parsed) && parsed > 0) {
      query.limit = Math.min(parsed, max_bookmarks_per_page);
    }
  }

  return query;
}

/**
 * List bookmarks with optional tag filtering and pagination.
 *
 * Returns bookmarks sorted by createdAt descending. Supports filtering
 * by tag and limiting the result count.
 */
export function listBookmarks(
  params: Record<string, unknown>,
): Bookmark[] {
  const query = parseListQuery(params);
  let results = [...bookmarks];

  if (query.tag) {
    results = results.filter((bookmark) =>
      bookmark.tags.some((t) => t === query.tag),
    );
  }

  results.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const limit = query.limit ?? 20;
  return results.slice(0, limit);
}

/**
 * Find a bookmark by its ID.
 *
 * Returns the bookmark or undefined if not found.
 */
export function findBookmarkById(id: string): Bookmark | undefined {
  return bookmarks.find((b) => b.id === id);
}

/**
 * Delete a bookmark by ID.
 *
 * Returns true if the bookmark was found and removed.
 * Returns an ApiError with status 404 if not found.
 */
export function deleteBookmark(id: string): true | ApiError {
  const index = bookmarks.findIndex((b) => b.id === id);

  if (index === -1) {
    return { status: 404, message: `Bookmark not found: ${id}` };
  }

  bookmarks.splice(index, 1);
  return true;
}

/**
 * Update a bookmark's title and tags.
 *
 * Returns the updated bookmark or an ApiError if not found.
 */
export function updateBookmark(
  id: string,
  updates: Record<string, unknown>,
): Bookmark | ApiError {
  const bookmark = findBookmarkById(id);

  if (!bookmark) {
    return { status: 404, message: `Bookmark not found: ${id}` };
  }

  if (isNonEmptyString(updates['title'])) {
    bookmark.title = updates['title'];
  }

  if (Array.isArray(updates['tags'])) {
    bookmark.tags = updates['tags']
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase());
  }

  return bookmark;
}

/**
 * Search bookmarks by title substring.
 *
 * Case-insensitive search across all bookmark titles.
 */
export function searchBookmarks(query: string): Bookmark[] {
  const search = query.toLowerCase();
  return bookmarks.filter((b) =>
    b.title.toLowerCase().includes(search),
  );
}

/**
 * Get bookmark counts grouped by tag.
 *
 * Returns a record mapping each tag to its count.
 */
export function getTagCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Get all unique tags across all bookmarks.
 *
 * Returns a sorted array of unique tag strings.
 */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      tagSet.add(tag);
    }
  }

  return [...tagSet].sort();
}

/**
 * Remove a specific tag from all bookmarks.
 *
 * Returns the number of bookmarks that were modified.
 */
export function removeTagFromAll(tagToRemove: string): number {
  let modified = 0;
  const normalizedTag = tagToRemove.toLowerCase();

  for (const bookmark of bookmarks) {
    const before = bookmark.tags.length;
    bookmark.tags = bookmark.tags.filter((t) => t !== normalizedTag);
    if (bookmark.tags.length < before) {
      modified += 1;
    }
  }

  return modified;
}

/**
 * Clear all bookmarks from storage.
 *
 * Used for testing and data reset operations.
 */
export function clearAllBookmarks(): number {
  const count = bookmarks.length;
  bookmarks.length = 0;
  return count;
}

/**
 * Get the total number of stored bookmarks.
 */
export function getBookmarkCount(): number {
  return bookmarks.length;
}

/**
 * Check if a bookmark with the given URL already exists.
 */
export function bookmarkExistsByUrl(url: string): boolean {
  return bookmarks.some((b) => b.url === url);
}

/**
 * Get the most recently created bookmarks.
 */
export function getRecentBookmarks(count: number): Bookmark[] {
  return [...bookmarks]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, count);
}

/**
 * Export all bookmarks as a serializable array.
 *
 * Creates a deep copy to prevent mutation of internal state.
 */
export function exportBookmarks(): Bookmark[] {
  return bookmarks.map((b) => ({
    id: b.id,
    url: b.url,
    title: b.title,
    tags: [...b.tags],
    createdAt: b.createdAt,
  }));
}

/**
 * Import bookmarks from an external data source.
 *
 * Validates each entry and skips invalid ones.
 * Returns the number of successfully imported bookmarks.
 */
export function importBookmarks(
  data: Record<string, unknown>[],
): number {
  let imported = 0;

  for (const entry of data) {
    if (
      isNonEmptyString(entry['url']) &&
      isNonEmptyString(entry['title']) &&
      isValidUrl(entry['url'])
    ) {
      const bookmark: Bookmark = {
        id: createId(),
        url: entry['url'],
        title: entry['title'],
        tags: Array.isArray(entry['tags'])
          ? entry['tags'].filter((t): t is string => typeof t === 'string')
          : [],
        createdAt: new Date().toISOString(),
      };
      bookmarks.push(bookmark);
      imported += 1;
    }
  }

  return imported;
}

/** Default handler for unmatched routes. */
export default function notFoundHandler(): ApiError {
  return { status: 404, message: 'Route not found' };
}
