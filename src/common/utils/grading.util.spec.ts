import { describe, expect, it } from 'vitest';
import {
  calculateGpa,
  DEFAULT_GRADE_SCALE,
  DEFAULT_PASS_MARK,
  percentageToBand,
  type GradeBand,
} from './grading.util.js';

describe('percentageToBand', () => {
  it('maps percentages to the default scale', () => {
    expect(percentageToBand(95)).toEqual({ min: 90, letter: 'A', points: 4.0 });
    expect(percentageToBand(90)).toEqual({ min: 90, letter: 'A', points: 4.0 });
    expect(percentageToBand(89.9)).toEqual({ min: 80, letter: 'B', points: 3.0 });
    expect(percentageToBand(70)).toEqual({ min: 70, letter: 'C', points: 2.0 });
    expect(percentageToBand(60)).toEqual({ min: 60, letter: 'D', points: 1.0 });
    expect(percentageToBand(59.99)).toEqual({ min: 0, letter: 'F', points: 0.0 });
    expect(percentageToBand(0)).toEqual({ min: 0, letter: 'F', points: 0.0 });
  });

  it('returns null for non-finite percentages', () => {
    expect(percentageToBand(Number.NaN)).toBeNull();
    expect(percentageToBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('supports a custom scale', () => {
    const scale: GradeBand[] = [
      { min: 50, letter: 'P', points: 2.0 },
      { min: 0, letter: 'X', points: 0.0 },
    ];
    expect(percentageToBand(75, scale)).toEqual({ min: 50, letter: 'P', points: 2.0 });
    expect(percentageToBand(10, scale)).toEqual({ min: 0, letter: 'X', points: 0.0 });
  });

  it('exposes a documented pass threshold', () => {
    expect(DEFAULT_PASS_MARK).toBe(60);
  });
});

describe('calculateGpa', () => {
  it('computes a credit-weighted GPA', () => {
    const gpa = calculateGpa([
      { totalMark: 95, creditHours: 3 },
      { totalMark: 95, creditHours: 3 },
      { totalMark: 75, creditHours: 4 },
    ]);
    expect(gpa).toBe(3.2);
  });

  it('ignores entries without a total mark', () => {
    expect(calculateGpa([])).toBeNull();
    expect(calculateGpa([{ totalMark: null, creditHours: 3 }])).toBeNull();
    expect(
      calculateGpa([
        { totalMark: 90, creditHours: 3 },
        { totalMark: null, creditHours: 3 },
      ]),
    ).toBe(4.0);
  });

  it('rounds the result to two decimals', () => {
    const gpa = calculateGpa([
      { totalMark: 100, creditHours: 3 },
      { totalMark: 100, creditHours: 3 },
      { totalMark: 61, creditHours: 3 },
    ]);
    expect(gpa).toBe(3);
  });

  it('uses the default scale when none is provided', () => {
    const gpa = calculateGpa([{ totalMark: 89, creditHours: 2 }]);
    expect(gpa).toBe(3);
    expect(DEFAULT_GRADE_SCALE.length).toBeGreaterThan(0);
  });
});