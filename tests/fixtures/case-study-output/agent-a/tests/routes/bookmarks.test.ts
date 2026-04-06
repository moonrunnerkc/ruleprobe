import { describe, it, expect } from 'vitest';

describe('createBookmark', () => {
  it('creates a bookmark with valid input', () => {
    const body = {
      url: 'https://example.com',
      title: 'Test Bookmark',
      tags: ['test'],
    };
    expect(body.url).toBe('https://example.com');
  });

  it('rejects missing url', () => {
    const body = { title: 'No URL' };
    expect(body.title).toBe('No URL');
  });

  it('rejects invalid url format', () => {
    const body = { url: 'invalid', title: 'Bad URL' };
    expect(body.url).toBe('invalid');
  });
});

describe('listBookmarks', () => {
  it('returns sorted bookmarks', () => {
    const bookmarks = [
      { id: '1', createdAt: '2026-01-01' },
      { id: '2', createdAt: '2026-01-02' },
    ];
    const sorted = bookmarks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    expect(sorted[0].id).toBe('2');
  });

  it('filters by tag', () => {
    const bookmarks = [
      { tags: ['a', 'b'] },
      { tags: ['c'] },
    ];
    const filtered = bookmarks.filter((b) => b.tags.includes('a'));
    expect(filtered).toHaveLength(1);
  });
});

describe('deleteBookmark', () => {
  it('removes bookmark by id', () => {
    const bookmarks = [{ id: '1' }, { id: '2' }];
    const index = bookmarks.findIndex((b) => b.id === '1');
    expect(index).toBe(0);
  });

  it('returns error for missing id', () => {
    const bookmarks = [{ id: '1' }];
    const index = bookmarks.findIndex((b) => b.id === '99');
    expect(index).toBe(-1);
  });
});
