import { describe, expect, it } from 'vitest';
import { buildPaginatedResult, getSkip } from './pagination.util.js';

describe('buildPaginatedResult', () => {
  it('builds the pagination envelope', () => {
    expect(buildPaginatedResult(['a', 'b'], 5, 2, 2)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it('caps totalPages at ceil(total / limit)', () => {
    expect(buildPaginatedResult([], 10, 1, 3).meta.totalPages).toBe(4);
    expect(buildPaginatedResult([], 9, 1, 3).meta.totalPages).toBe(3);
  });

  it('returns zero totalPages when limit is zero', () => {
    expect(buildPaginatedResult([], 10, 1, 0).meta.totalPages).toBe(0);
  });

  it('handles an empty page', () => {
    expect(buildPaginatedResult([], 0, 1, 10)).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });
});

describe('getSkip', () => {
  it('computes the offset for 1-based pages', () => {
    expect(getSkip(1, 10)).toBe(0);
    expect(getSkip(2, 10)).toBe(10);
    expect(getSkip(3, 25)).toBe(50);
  });
});