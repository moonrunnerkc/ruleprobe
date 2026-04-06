import { describe, it, expect } from 'vitest';

describe('createId', () => {
  it('generates string IDs', () => {
    const id = `bk_${Date.now()}_1`;
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^bk_/);
  });

  it('generates unique IDs', () => {
    const id1 = `bk_${Date.now()}_1`;
    const id2 = `bk_${Date.now()}_2`;
    expect(id1).not.toBe(id2);
  });
});
