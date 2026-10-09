import { describe, expect, it } from 'vitest';
import { numericTransformer } from './transformers.js';

describe('numericTransformer', () => {
  it('passes values through on write', () => {
    expect(numericTransformer.to(12.5)).toBe(12.5);
    expect(numericTransformer.to(null)).toBeNull();
    expect(numericTransformer.to(undefined)).toBeUndefined();
  });

  it('parses pg string numerics on read', () => {
    expect(numericTransformer.from('12.50')).toBe(12.5);
    expect(numericTransformer.from('0')).toBe(0);
    expect(numericTransformer.from('66.666')).toBe(66.666);
  });

  it('passes numbers through on read', () => {
    expect(numericTransformer.from(12.5)).toBe(12.5);
  });

  it('returns null for empty values on read', () => {
    expect(numericTransformer.from('')).toBeNull();
    expect(numericTransformer.from(null)).toBeNull();
    expect(numericTransformer.from(undefined)).toBeNull();
  });
});