import { describe, expect, it } from 'vitest';
import { parseDurationToMs } from './duration.util.js';

describe('parseDurationToMs', () => {
  it('parses supported units', () => {
    expect(parseDurationToMs('15m', 0)).toBe(900_000);
    expect(parseDurationToMs('7d', 0)).toBe(604_800_000);
    expect(parseDurationToMs('2h', 0)).toBe(7_200_000);
    expect(parseDurationToMs('3600s', 0)).toBe(3_600_000);
    expect(parseDurationToMs('500ms', 0)).toBe(500);
  });

  it('is case-insensitive and tolerant of surrounding whitespace', () => {
    expect(parseDurationToMs('20M', 0)).toBe(1_200_000);
    expect(parseDurationToMs(' 15m ', 0)).toBe(900_000);
    expect(parseDurationToMs('1H', 0)).toBe(3_600_000);
  });

  it('returns zero for an explicit zero duration', () => {
    expect(parseDurationToMs('0m', -1)).toBe(0);
    expect(parseDurationToMs('0s', -1)).toBe(0);
  });

  it('falls back for malformed input', () => {
    expect(parseDurationToMs('15', 42)).toBe(42);
    expect(parseDurationToMs('m', 42)).toBe(42);
    expect(parseDurationToMs('forever', 42)).toBe(42);
    expect(parseDurationToMs('-3d', 42)).toBe(42);
  });
});