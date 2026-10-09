import { describe, expect, it } from 'vitest';
import {
  calculateTotalMark,
  GRADE_MAX,
  GRADE_MIN,
  isValidMark,
  roundMark,
} from './grade.util.js';

describe('roundMark', () => {
  it('rounds to two decimals', () => {
    expect(roundMark(70.005)).toBe(70.01);
    expect(roundMark(70.004)).toBe(70);
    expect(roundMark(66.666)).toBe(66.67);
  });
});

describe('calculateTotalMark', () => {
  it('combines weighted project and exam marks', () => {
    expect(calculateTotalMark(80, 60, 50, 50)).toBe(70);
  });

  it('supports asymmetric weights', () => {
    expect(calculateTotalMark(50, 100, 60, 40)).toBe(70);
  });

  it('treats a missing component as zero', () => {
    expect(calculateTotalMark(80, null, 50, 50)).toBe(40);
    expect(calculateTotalMark(null, 100, 30, 70)).toBe(70);
    expect(calculateTotalMark(0, 0, 50, 50)).toBe(0);
  });

  it('returns null when both components are missing', () => {
    expect(calculateTotalMark(null, null, 50, 50)).toBeNull();
    expect(calculateTotalMark(undefined, undefined, 50, 50)).toBeNull();
  });
});

describe('isValidMark', () => {
  it('accepts missing marks', () => {
    expect(isValidMark(null)).toBe(true);
    expect(isValidMark(undefined)).toBe(true);
  });

  it('accepts the full range', () => {
    expect(isValidMark(GRADE_MIN)).toBe(true);
    expect(isValidMark(GRADE_MAX)).toBe(true);
    expect(isValidMark(33.333)).toBe(true);
  });

  it('rejects marks outside the range or non-finite', () => {
    expect(isValidMark(-1)).toBe(false);
    expect(isValidMark(101)).toBe(false);
    expect(isValidMark(Number.NaN)).toBe(false);
    expect(isValidMark(Number.POSITIVE_INFINITY)).toBe(false);
  });
});