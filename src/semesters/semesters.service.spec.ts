import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import type { ResolvedScope } from '../users/academic-scope.js';
import type { CreateSemesterDto } from './dto/create-semester.dto.js';
import { Semester } from './entities/semester.entity.js';
import { SemestersService } from './semesters.service.js';

const P_A = '00000000-0000-4000-8000-00000000000a';
const P_B = '00000000-0000-4000-8000-00000000000b';
const SEM_1 = '00000000-0000-4000-8000-0000000000s1';

const ADMIN_SCOPE: ResolvedScope = {
  userId: 'admin-1',
  role: UserRole.ADMIN,
  programId: null,
  assignedSubjectIds: [],
};

function studentScope(programId: string | null = P_A): ResolvedScope {
  return { userId: 'stu-1', role: UserRole.STUDENT, programId, assignedSubjectIds: [] };
}

function programManagerScope(programId: string | null = P_A): ResolvedScope {
  return { userId: 'pm-1', role: UserRole.PROGRAM_MANAGER, programId, assignedSubjectIds: [] };
}

function makeSemester(overrides: Partial<Semester> = {}): Semester {
  return {
    id: SEM_1,
    programId: P_A,
    name: 'Fall 2025',
    code: 'F25',
    startDate: null,
    endDate: null,
    status: 'PLANNED',
    ...overrides,
  } as Semester;
}

interface HarnessOverrides {
  stored?: Semester[];
  saveError?: unknown;
  programExists?: boolean;
}

function makeService(overrides: HarnessOverrides = {}) {
  const stored = overrides.stored ?? [makeSemester()];
  const semesters = {
    create: (data: Partial<Semester>) => ({ ...data }) as Semester,
    save: async (s: Semester) => {
      if (overrides.saveError) {
        throw overrides.saveError;
      }
      return s;
    },
    remove: async (s: Semester) => s,
    findOne: async ({ where }: { where: { id: string } }) =>
      stored.find((s) => s.id === where.id) ?? null,
  } as unknown as Repository<Semester>;
  const programs = {
    exists: async () => overrides.programExists ?? true,
  } as unknown as Repository<AcademicProgram>;
  return new SemestersService(semesters, programs);
}

function createDto(overrides: Partial<CreateSemesterDto> = {}): CreateSemesterDto {
  return {
    programId: P_A,
    name: 'Fall 2025',
    code: 'F25',
    status: 'PLANNED' as never,
    ...overrides,
  } as CreateSemesterDto;
}

/** Minimal query-builder recorder for findAll scope assertions. */
function makeQbHarness() {
  const calls: string[] = [];
  const qb: Record<string, unknown> = {};
  for (const method of ['leftJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take']) {
    qb[method] = (...args: unknown[]) => {
      calls.push(`${method}:${typeof args[0] === 'string' ? args[0] : ''}`);
      return qb;
    };
  }
  qb.getManyAndCount = async () => [[], 0];
  return { calls, qb };
}

describe('SemestersService scope enforcement', () => {
  it('admin may create a semester in any program', async () => {
    const service = makeService({ programExists: true });
    const created = await service.create(createDto({ programId: P_B }), ADMIN_SCOPE);
    expect(created.programId).toBe(P_B);
  });

  it('a Program Manager may only create semesters in their own program (forced)', async () => {
    const service = makeService();
    const created = await service.create(createDto(), programManagerScope(P_A));
    expect(created.programId).toBe(P_A);

    await expect(
      service.create(createDto({ programId: P_B }), programManagerScope(P_A)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses semester creation for a manager without a program', async () => {
    const service = makeService();
    await expect(service.create(createDto(), programManagerScope(null))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('hides semesters of another program from a student (404, not 403)', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_B })] });
    await expect(service.findOne(SEM_1, studentScope(P_A))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows a student to read semesters of their own program', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_A })] });
    const semester = await service.findOne(SEM_1, studentScope(P_A));
    expect(semester.code).toBe('F25');
  });

  it('a student with no academic program reaches no semesters', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_A })] });
    await expect(service.findOne(SEM_1, studentScope(null))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies the program filter to a student list query', async () => {
    const service = makeService();
    const { calls, qb } = makeQbHarness();
    (service as unknown as { semesters: { createQueryBuilder: () => unknown } }).semesters = {
      createQueryBuilder: () => qb,
    };
    await service.findAll({ page: 1, limit: 20 } as never, studentScope(P_A));
    expect(calls.some((c) => c.includes('semester.programId = :scopeProgramId'))).toBe(true);
  });

  it('does not filter the list query for an admin', async () => {
    const service = makeService();
    const { calls, qb } = makeQbHarness();
    (service as unknown as { semesters: { createQueryBuilder: () => unknown } }).semesters = {
      createQueryBuilder: () => qb,
    };
    await service.findAll({ page: 1, limit: 20 } as never, ADMIN_SCOPE);
    expect(calls.some((c) => c.includes('scopeProgramId'))).toBe(false);
  });

  it('a client-supplied programId cannot widen a student scope', async () => {
    const service = makeService();
    const { calls, qb } = makeQbHarness();
    (service as unknown as { semesters: { createQueryBuilder: () => unknown } }).semesters = {
      createQueryBuilder: () => qb,
    };
    await service.findAll({ page: 1, limit: 20, programId: P_B } as never, studentScope(P_A));
    // Both filters are AND-combined: the scope filter still references P_A.
    expect(calls.some((c) => c.includes('semester.programId = :scopeProgramId'))).toBe(true);
    expect(calls.some((c) => c.includes('semester.programId = :programId'))).toBe(true);
  });

  it('a Program Manager cannot update a semester of another program', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_B })] });
    await expect(
      service.update(SEM_1, { name: 'X' }, programManagerScope(P_A)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a Program Manager cannot move a semester to another program', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_A })] });
    await expect(
      service.update(SEM_1, { programId: P_B }, programManagerScope(P_A)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('an admin may move a semester to another existing program', async () => {
    const service = makeService({ stored: [makeSemester({ programId: P_A })] });
    const updated = await service.update(SEM_1, { programId: P_B }, ADMIN_SCOPE);
    expect(updated.programId).toBe(P_B);
  });

  it('a Program Manager may delete a semester of their own program only', async () => {
    const inScope = makeService({ stored: [makeSemester({ programId: P_A })] });
    await expect(inScope.remove(SEM_1, programManagerScope(P_A))).resolves.toBeUndefined();

    const outOfScope = makeService({ stored: [makeSemester({ programId: P_B })] });
    await expect(outOfScope.remove(SEM_1, programManagerScope(P_A))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SemestersService validation', () => {
  it('rejects an unknown program reference', async () => {
    const service = makeService({ programExists: false });
    await expect(service.create(createDto(), ADMIN_SCOPE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps unique (program, code) violations to a BadRequestException', async () => {
    const service = makeService({ saveError: { code: '23505' } });
    await expect(service.create(createDto(), ADMIN_SCOPE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an inverted date range', async () => {
    const service = makeService();
    await expect(
      service.create(createDto({ startDate: '2026-02-01', endDate: '2026-01-01' }), ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
