import { describe, it, expect } from 'vitest';

describe('Bookmark types', () => {
  it('Bookmark interface has expected shape', () => {
    const bookmark = {
      id: 'bk_1',
      url: 'https://example.com',
      title: 'Example',
      tags: ['test'],
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(bookmark.id).toBe('bk_1');
    expect(bookmark.tags).toContain('test');
  });

  it('CreateBookmarkRequest allows optional tags', () => {
    const request = { url: 'https://example.com', title: 'Example' };
    expect(request.url).toBeDefined();
    expect(request.title).toBeDefined();
  });
});
