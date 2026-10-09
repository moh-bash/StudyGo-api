import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './db.util.js';

describe('isUniqueViolation', () => {
  it('recognises Postgres unique-violation errors (SQLSTATE 23505)', () => {
    expect(isUniqueViolation({ code: '23505', detail: 'Duplicate key' })).toBe(true);
  });

  it('rejects other codes and malformed values', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});