import { describe, it, expect } from 'vitest';
import { safeCast, classifyNumber } from '../src/extended-clean';

/** Sample positive value used by the classification test. */
const SAMPLE_POSITIVE = 5;

describe('extended-clean', () => {
  it('safely casts a string value', () => {
    expect(safeCast('hello')).toBe('hello');
  });

  it('classifies a positive number', () => {
    expect(classifyNumber(SAMPLE_POSITIVE)).toBe('positive');
  });
});
