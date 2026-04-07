import { describe, it, expect } from 'vitest';
import { safeCast, classifyNumber } from '../src/extended-clean';

describe('extended-clean', () => {
  it('safely casts a string value', () => {
    expect(safeCast('hello')).toBe('hello');
  });

  it('classifies a positive number', () => {
    expect(classifyNumber(5)).toBe('positive');
  });
});
