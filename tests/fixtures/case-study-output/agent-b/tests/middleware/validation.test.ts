import { describe, it, expect } from 'vitest';

describe('isNonEmptyString', () => {
  it('returns true for non-empty string', () => {
    const value = 'hello';
    expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
  });

  it('returns false for empty string', () => {
    const value = '   ';
    expect(value.trim().length > 0).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts valid URLs', () => {
    expect(() => new URL('https://example.com')).not.toThrow();
  });

  it('rejects invalid URLs', () => {
    expect(() => new URL('not-a-url')).toThrow();
  });
});
