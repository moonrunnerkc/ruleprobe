/** Route handlers for the bookmarks API. */

import { createId } from '../utils/id.js';
import type {
  Bookmark,
  CreateBookmarkRequest,
  BookmarkListQuery,
  ApiError,
} from '../types.js';

const bookmarks: Bookmark[] = [];

/**
 * Create a new bookmark.
 *
 * Validates input and returns the created bookmark with a generated ID.
 */
export function createBookmark(body: any): Bookmark | ApiError {
  const { url, title, tags } = body as CreateBookmarkRequest;

  if (!url || !title) {
    return { status: 400, message: 'Missing required fields: url and title' };
  }

  try {
    new URL(url);
  } catch {
    return { status: 400, message: 'Invalid URL format' };
  }

  const bookmark: Bookmark = {
    id: createId(),
    url,
    title,
    tags: tags ?? [],
    createdAt: new Date().toISOString(),
  };

  bookmarks.push(bookmark);
  console.log(`Bookmark created: ${bookmark.id}`);
  return bookmark;
}

/**
 * List bookmarks with optional tag filtering.
 *
 * Returns bookmarks sorted by createdAt descending.
 */
export function listBookmarks(query: any): Bookmark[] {
  let results = [...bookmarks];

  if (query.tag) {
    results = results.filter((b) => b.tags.includes(query.tag));
  }

  const limit = query.limit ?? 20;
  results = results.slice(0, limit);

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Delete a bookmark by ID.
 *
 * Returns true if found and deleted, or an ApiError if not found.
 */
export function deleteBookmark(id: string): true | ApiError {
  const index = bookmarks.findIndex((b) => b.id === id);

  if (index === -1) {
    return { status: 404, message: `Bookmark not found: ${id}` };
  }

  bookmarks.splice(index, 1);
  return true;
}
