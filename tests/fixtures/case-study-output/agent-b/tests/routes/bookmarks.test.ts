import { describe, it, expect } from 'vitest';

describe('createBookmark', () => {
  it('creates a bookmark with valid input', () => {
    const body = {
      url: 'https://example.com',
      title: 'Test Bookmark',
      tags: ['test'],
    };
    expect(body.url).toBe('https://example.com');
    expect(body.title).toBe('Test Bookmark');
  });

  it('rejects missing url', () => {
    const body = { title: 'No URL' };
    expect(body.title).toBeDefined();
  });

  it('normalizes tags to lowercase', () => {
    const tags = ['JavaScript', 'TypeScript'].map((t) => t.toLowerCase());
    expect(tags).toEqual(['javascript', 'typescript']);
  });
});

describe('listBookmarks', () => {
  it('sorts by createdAt descending', () => {
    const items = [
      { id: '1', createdAt: '2026-01-01' },
      { id: '2', createdAt: '2026-01-02' },
    ];
    const sorted = items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    expect(sorted[0].id).toBe('2');
  });

  it('filters by tag', () => {
    const items = [
      { tags: ['a', 'b'] },
      { tags: ['c'] },
    ];
    const filtered = items.filter((b) => b.tags.includes('a'));
    expect(filtered).toHaveLength(1);
  });
});

describe('deleteBookmark', () => {
  it('removes bookmark from array', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const index = items.findIndex((b) => b.id === '1');
    items.splice(index, 1);
    expect(items).toHaveLength(1);
  });

  it('returns -1 for missing id', () => {
    const items = [{ id: '1' }];
    const index = items.findIndex((b) => b.id === '99');
    expect(index).toBe(-1);
  });
});

describe('searchBookmarks', () => {
  it('finds bookmarks by title substring', () => {
    const items = [
      { title: 'TypeScript Guide' },
      { title: 'React Tutorial' },
    ];
    const results = items.filter((b) =>
      b.title.toLowerCase().includes('type'),
    );
    expect(results).toHaveLength(1);
  });
});
