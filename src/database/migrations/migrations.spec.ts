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

  it('registers AddUserPhone exactly once and before SubjectCodeProgramScope', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'AddUserPhone1792470000000');
    expect(matches).toHaveLength(1);
    const phoneIndex = MIGRATIONS.findIndex((m) => m.name === 'AddUserPhone1792470000000');
    const subjectCodeIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectCodeProgramScope1792500000000',
    );
    expect(phoneIndex).toBeGreaterThan(
      MIGRATIONS.findIndex((m) => m.name === 'AcademicRoles1791798594481'),
    );
    expect(phoneIndex).toBeLessThan(subjectCodeIndex);
  });

  it('registers SubjectCodeProgramScope exactly once, before SubjectWeightDefaults', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'SubjectCodeProgramScope1792500000000');
    expect(matches).toHaveLength(1);
    const subjectCodeIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectCodeProgramScope1792500000000',
    );
    const weightDefaultsIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectWeightDefaults1792510000000',
    );
    expect(subjectCodeIndex).toBeLessThan(weightDefaultsIndex);
  });

  it('registers SubjectWeightDefaults exactly once and before SubjectTeams', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'SubjectWeightDefaults1792510000000');
    expect(matches).toHaveLength(1);
    const weightDefaultsIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectWeightDefaults1792510000000',
    );
    const subjectTeamsIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectTeams1792600000000',
    );
    expect(weightDefaultsIndex).toBeLessThan(subjectTeamsIndex);
  });

  it('registers SubjectTeams exactly once and last', () => {
    const matches = MIGRATIONS.filter((m) => m.name === 'SubjectTeams1792600000000');
    expect(matches).toHaveLength(1);
    const subjectTeamsIndex = MIGRATIONS.findIndex(
      (m) => m.name === 'SubjectTeams1792600000000',
    );
    expect(subjectTeamsIndex).toBe(MIGRATIONS.length - 1);
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

  it('SubjectWeightDefaults only changes column defaults (25/75 up, 0/100 down)', async () => {
    const { SubjectWeightDefaults1792510000000 } = await import(
      './1792510000000-SubjectWeightDefaults.js'
    );
    const migration = new SubjectWeightDefaults1792510000000();
    const statements: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        statements.push(sql);
      },
    } as unknown as Parameters<typeof migration.up>[0];

    await migration.up(queryRunner);
    expect(statements).toEqual([
      'ALTER TABLE "subjects" ALTER COLUMN "projectWeight" SET DEFAULT 25',
      'ALTER TABLE "subjects" ALTER COLUMN "examWeight" SET DEFAULT 75',
    ]);

    statements.length = 0;
    await migration.down(queryRunner);
    expect(statements).toEqual([
      'ALTER TABLE "subjects" ALTER COLUMN "projectWeight" SET DEFAULT 0',
      'ALTER TABLE "subjects" ALTER COLUMN "examWeight" SET DEFAULT 100',
    ]);
  });
});
