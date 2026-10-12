import type { FindManyOptions, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AcademicProgram } from './entities/program.entity.js';
import { ProgramsService } from './programs.service.js';

function makeProgram(overrides: Partial<AcademicProgram> = {}): AcademicProgram {
  return {
    id: 'program-1',
    name: 'Information Technology',
    code: 'IT',
    description: 'internal note that must never leak',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as AcademicProgram;
}

/** Fake repo that honours the `where.isActive` filter and `select` projection. */
function makeService(rows: AcademicProgram[]) {
  const programs = {
    find: async (options?: FindManyOptions<AcademicProgram>) => {
      const isActive = (options?.where as { isActive?: boolean } | undefined)?.isActive;
      return rows.filter((row) => isActive === undefined || row.isActive === isActive);
    },
  } as unknown as Repository<AcademicProgram>;
  return new ProgramsService(programs);
}

describe('ProgramsService.findActiveForRegistration', () => {
  it('returns only active programs', async () => {
    const service = makeService([
      makeProgram({ id: 'active-1', name: 'Information Technology', isActive: true }),
      makeProgram({ id: 'inactive-1', name: 'Legacy Program', isActive: false }),
    ]);
    const result = await service.findActiveForRegistration();
    expect(result.map((p) => p.id)).toEqual(['active-1']);
  });

  it('exposes only id, name and code (no internal fields)', async () => {
    const service = makeService([makeProgram({ code: 'IT' })]);
    const [program] = await service.findActiveForRegistration();
    expect(Object.keys(program).sort()).toEqual(['code', 'id', 'name']);
  });

  it('preserves a null code', async () => {
    const service = makeService([makeProgram({ code: null })]);
    const [program] = await service.findActiveForRegistration();
    expect(program.code).toBeNull();
  });

  it('returns an empty list when no active programs exist', async () => {
    const service = makeService([
      makeProgram({ id: 'inactive-1', isActive: false }),
      makeProgram({ id: 'inactive-2', isActive: false }),
    ]);
    await expect(service.findActiveForRegistration()).resolves.toEqual([]);
  });
});
