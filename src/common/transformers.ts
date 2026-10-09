import type { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL `numeric`/`decimal` values are returned as strings by the `pg`
 * driver. This transformer converts them to JS numbers on read and leaves them
 * untouched on write, so entities can use `number` types everywhere.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return typeof value === 'number' ? value : Number.parseFloat(value);
  },
};
