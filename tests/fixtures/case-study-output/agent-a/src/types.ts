/** Bookmark type definitions. */

/** A stored bookmark entry. */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  tags: string[];
  createdAt: string;
}

/** Shape of the POST /bookmarks request body. */
export interface CreateBookmarkRequest {
  url: string;
  title: string;
  tags?: string[];
}

/** Query parameters for GET /bookmarks. */
export interface BookmarkListQuery {
  tag?: string;
  limit?: number;
}

/** Standard API error response. */
export interface ApiError {
  status: number;
  message: string;
}
