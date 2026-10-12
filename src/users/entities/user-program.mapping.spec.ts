import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AcademicProgram } from '../../programs/entities/program.entity.js';
import { User } from './user.entity.js';

/**
 * Verifies the Phase 1 user↔program mapping at the ORM-metadata level (no DB).
 * This proves how TypeORM will map the entity; it is not a schema/database test.
 */
const storage = getMetadataArgsStorage();

describe('User ↔ AcademicProgram mapping (ORM metadata)', () => {
  it('maps the User entity to the users table', () => {
    const table = storage.tables.find((t) => t.target === User);
    expect(table?.name).toBe('users');
  });

  it('declares programId as a nullable uuid column', () => {
    const column = storage.columns.find((c) => c.target === User && c.propertyName === 'programId');
    expect(column).toBeDefined();
    expect(column?.options.type).toBe('uuid');
    expect(column?.options.nullable).toBe(true);
  });

  it('names the programId index IDX_users_program_id', () => {
    const index = storage.indices.find(
      (i) =>
        i.target === User &&
        Array.isArray(i.columns) &&
        i.columns.includes('programId'),
    );
    expect(index?.name).toBe('IDX_users_program_id');
  });

  it('binds programId to AcademicProgram with ON DELETE SET NULL', () => {
    const relation = storage.relations.find(
      (r) => r.target === User && r.propertyName === 'program',
    );
    expect(relation).toBeDefined();
    if (!relation) throw new Error('program relation metadata missing');
    expect(relation.relationType).toBe('many-to-one');
    expect((relation.options as { onDelete?: string }).onDelete).toBe('SET NULL');
    expect((relation.type as () => unknown)()).toBe(AcademicProgram);
  });

  it('joins the relation on the programId column', () => {
    const join = storage.joinColumns.find(
      (j) => j.target === User && j.propertyName === 'program',
    );
    expect(join).toBeDefined();
    if (!join) throw new Error('program join column metadata missing');
    expect(join.name).toBe('programId');
  });

  it('keeps the relation unidirectional (no inverse side on AcademicProgram)', () => {
    const inverse = storage.relations.find(
      (r) => r.target === AcademicProgram && r.propertyName === 'users',
    );
    expect(inverse).toBeUndefined();
  });
});
