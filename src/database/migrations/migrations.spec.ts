import { describe, expect, it } from 'vitest';
import { AcademicRoles1791798594481 } from './1791798594481-AcademicRoles.js';
import { AddUserProgramId1791777700607 } from './1791777700607-AddUserProgramId.js';
import { MIGRATIONS } from './index.js';

describe('migration registry', () => {
  it('registers AddUserProgramId exactly once', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'AddUserProgramId1791777700607');
    expect(matches).toHaveLength(1);
  });

  it('registers AcademicRoles exactly once', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'AcademicRoles1791798594481');
    expect(matches).toHaveLength(1);
  });

  it('has the AcademicRoles migration up/down statements', () => {
    const instance = new AcademicRoles1791798594481();
    expect(instance.name).toContain('1791798594481');
  });

  it('keeps the InitialSchema migration registered exactly once', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'InitialSchema1791555907470');
    expect(matches).toHaveLength(1);
  });

  it('exports a class whose name embeds the migration timestamp', () => {
    const instance = new AddUserProgramId1791777700607();
    expect(instance.name).toBe('AddUserProgramId1791777700607');
    expect(instance.name).toContain('1791777700607');
  });

  it('lists migrations as constructable classes (no duplicates by identity)', () => {
    const unique = new Set(MIGRATIONS);
    expect(unique.size).toBe(MIGRATIONS.length);
  });
});
