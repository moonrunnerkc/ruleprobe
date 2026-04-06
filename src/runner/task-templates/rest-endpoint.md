# Task: REST API for User Bookmarks

Build a REST API for managing user bookmarks using TypeScript and Express.

## Endpoints

### POST /bookmarks

Create a new bookmark.

Request body:
- `url` (string, required): The bookmark URL
- `title` (string, required): Display title
- `tags` (string array, optional): Categorization tags

Returns the created bookmark with a generated `id` and `createdAt` timestamp.
Return HTTP 400 for missing required fields or invalid URL format.

### GET /bookmarks

List all bookmarks. Supports optional query parameters:

- `tag` (string): Filter bookmarks that include this tag
- `limit` (number): Maximum results to return (default 20)

Returns an array of bookmark objects sorted by `createdAt` descending.

### DELETE /bookmarks/:id

Delete a bookmark by ID.

Return HTTP 404 if the bookmark does not exist.
Return HTTP 204 on successful deletion.

## Technical Requirements

- TypeScript with Express
- Input validation on all endpoints
- Proper HTTP status codes for success and error cases
- Types exported for request and response shapes
- In-memory storage (no database required)

## Expected Output Structure

```
src/
  routes/bookmarks.ts       # Route handlers
  types.ts                  # Shared type definitions
  middleware/validation.ts   # Input validation logic
tests/
  routes/bookmarks.test.ts  # Endpoint tests
```

## Deliverables

1. Working route handlers for all three endpoints
2. Type definitions for Bookmark, CreateBookmarkRequest, and BookmarkListQuery
3. Validation middleware that rejects malformed input
4. Unit tests covering success and error cases for each endpoint
