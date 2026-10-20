import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import type { ResolvedScope } from '../users/academic-scope.js';
import { AcademicSection } from './entities/section.entity.js';
import { SectionSchedule } from './entities/section-schedule.entity.js';
import { SectionsService } from './sections.service.js';

const S_1 = '00000000-0000-4000-8000-000000000001';
const S_2 = '00000000-0000-4000-8000-000000000002';
const SEC_1 = '00000000-0000-4000-8000-0000000000c1';
const P_A = '00000000-0000-4000-8000-00000000000a';
const P_B = '00000000-0000-4000-8000-00000000000b';
const PROF = '00000000-0000-4000-8000-0000000000f1';

/** Minimal query-builder recorder asserting which filters findAll applies. */
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

function makeListService() {
  const service = makeService();
  const { calls, qb } = makeQbHarness();
  (service as unknown as { sections: { createQueryBuilder: () => unknown } }).sections = {
    createQueryBuilder: () => qb,
  };
  return { service, calls };
}

const ADMIN_SCOPE: ResolvedScope = {
  userId: 'admin-1',
  role: UserRole.ADMIN,
  programId: null,
  assignedSubjectIds: [],
};

function studentScope(programId: string | null = P_A): ResolvedScope {
  return { userId: 'stu-1', role: UserRole.STUDENT, programId, assignedSubjectIds: [] };
}

function subjectManagerScope(assigned: string[] = [S_1]): ResolvedScope {
  return { userId: 'sm-1', role: UserRole.SUBJECT_MANAGER, programId: P_A, assignedSubjectIds: assigned };
}

function programManagerScope(): ResolvedScope {
  return { userId: 'pm-1', role: UserRole.PROGRAM_MANAGER, programId: P_A, assignedSubjectIds: [] };
}

function makeSection(overrides: Partial<AcademicSection> = {}): AcademicSection {
  return {
    id: SEC_1,
    semesterId: 'sem-1',
    subjectId: S_1,
    professorId: PROF,
    code: 'SEC-A',
    location: null,
    deliveryMode: null,
    capacity: null,
    isActive: true,
    ...overrides,
  } as AcademicSection;
}

interface HarnessOverrides {
  section?: AcademicSection | null;
  subjects?: Array<Partial<Subject>>;
  semesters?: Array<Partial<Semester>>;
}

function makeService(overrides: HarnessOverrides = {}) {
  const section = overrides.section === undefined ? makeSection() : overrides.section;
  const subjects = overrides.subjects ?? [];
  const semesters = overrides.semesters ?? [{ id: 'sem-1', programId: P_A }];
  const sections = {
    findOne: async () => section,
    create: (data: Partial<AcademicSection>) => ({ ...data }) as AcademicSection,
    save: async (s: AcademicSection) => s,
    remove: async (s: AcademicSection) => s,
  } as unknown as Repository<AcademicSection>;
  const schedules = {
    find: async () => [],
    findOne: async () => null,
    create: (data: Partial<SectionSchedule>) => ({ ...data }) as SectionSchedule,
    save: async (s: SectionSchedule) => s,
    remove: async () => undefined,
  } as unknown as Repository<SectionSchedule>;
  const semesterRepo = {
    findOne: async ({ where }: { where: { id: string } }) =>
      (semesters.find((s) => s.id === where.id) ?? null) as Semester | null,
  } as unknown as Repository<Semester>;
  const subjectRepo = {
    findOne: async ({ where }: { where: { id: string } }) =>
      (subjects.find((s) => s.id === where.id) ?? null) as Subject | null,
  } as unknown as Repository<Subject>;
  const professors = { exists: async () => true } as unknown as Repository<Professor>;
  return new SectionsService(sections, schedules, semesterRepo, subjectRepo, professors);
}

describe('SectionsService scope enforcement', () => {
  it('admin may create a section for any existing subject', async () => {
    const service = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    const created = await service.create(
      { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
      ADMIN_SCOPE,
    );
    expect(created.subjectId).toBe(S_1);
    expect(created.professorId).toBe(PROF);
  });

  it('admin still gets a 400 for a nonexistent subject', async () => {
    const service = makeService({ subjects: [] });
    await expect(
      service.create(
        { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        ADMIN_SCOPE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a Subject Manager may create a section only for an assigned subject', async () => {
    const service = makeService({
      subjects: [
        { id: S_1, programId: P_A },
        { id: S_2, programId: P_A },
      ],
    });
    const created = await service.create(
      { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
      subjectManagerScope([S_1]),
    );
    expect(created.subjectId).toBe(S_1);

    await expect(
      service.create(
        { semesterId: 'sem-1', subjectId: S_2, professorId: PROF, code: 'Y' } as never,
        subjectManagerScope([S_1]),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a Program Manager may create a section only inside their program', async () => {
    const inProgram = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    await expect(
      inProgram.create(
        { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        programManagerScope(),
      ),
    ).resolves.toBeTruthy();

    const outOfProgram = makeService({ subjects: [{ id: S_2, programId: P_B }] });
    await expect(
      outOfProgram.create(
        { semesterId: 'sem-1', subjectId: S_2, professorId: PROF, code: 'X' } as never,
        programManagerScope(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides a section whose subject is outside the manager scope', async () => {
    const service = makeService({
      section: makeSection({ subject: { id: S_2, programId: P_B } as Subject }),
    });
    await expect(service.findOne(SEC_1, programManagerScope())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a manager update that targets an out-of-scope subject', async () => {
    const service = makeService({
      section: makeSection({ subjectId: S_1 }),
      subjects: [
        { id: S_1, programId: P_A },
        { id: S_2, programId: P_B },
      ],
    });
    await expect(
      service.update(SEC_1, { subjectId: S_2 } as never, subjectManagerScope([S_1])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a manager delete of an out-of-scope section', async () => {
    const service = makeService({
      section: makeSection({ subjectId: S_1 }),
      subjects: [{ id: S_1, programId: P_A }],
    });
    await expect(service.remove(SEC_1, subjectManagerScope([S_2]))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('scopes schedule creation through the section subject', async () => {
    const service = makeService({
      section: makeSection({ subjectId: S_1 }),
      subjects: [{ id: S_1, programId: P_A }],
    });
    await expect(
      service.addSchedule(
        SEC_1,
        { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '09:00' } as never,
        subjectManagerScope([S_2]),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SectionsService admin scope (audit F-03 regression)', () => {
  it('an admin list query is not restricted to any academic program', async () => {
    const { service, calls } = makeListService();
    await service.findAll({ page: 1, limit: 20 } as never, ADMIN_SCOPE);
    // Regression: admins have programId === null, which must NOT fall through to
    // the student branch and emit the always-empty filter.
    expect(calls).not.toContainEqual('andWhere:1 = 0');
    expect(calls.some((c) => c.includes(':scopeProgramId'))).toBe(false);
  });

  it('an admin list query is not restricted to assigned subjects', async () => {
    const { service, calls } = makeListService();
    await service.findAll({ page: 1, limit: 20 } as never, ADMIN_SCOPE);
    expect(calls.some((c) => c.includes('scopeSubjectIds'))).toBe(false);
  });
});

describe('SectionsService student scope (audit F-03)', () => {
  it('a student may read a section whose subject belongs to their program', async () => {
    const service = makeService({
      section: makeSection({ subject: { id: S_1, programId: P_A } as Subject }),
    });
    const section = await service.findOne(SEC_1, studentScope(P_A));
    expect(section.id).toBe(SEC_1);
  });

  it('hides sections of another specialization from a student (404, not 403)', async () => {
    const service = makeService({
      section: makeSection({ subject: { id: S_1, programId: P_B } as Subject }),
    });
    await expect(service.findOne(SEC_1, studentScope(P_A))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a student with no academic program reaches nothing', async () => {
    const service = makeService({
      section: makeSection({ subject: { id: S_1, programId: P_A } as Subject }),
    });
    await expect(service.findOne(SEC_1, studentScope(null))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a student cannot read schedules of an out-of-scope section', async () => {
    const service = makeService({
      section: makeSection({ subject: { id: S_1, programId: P_B } as Subject }),
    });
    await expect(service.listSchedules(SEC_1, studentScope(P_A))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a student cannot create sections even for their own program', async () => {
    const service = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    await expect(
      service.create(
        { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        studentScope(P_A),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SectionsService academic relationship integrity', () => {
  it('rejects a section whose subject and semester belong to different programs', async () => {
    const service = makeService({
      subjects: [{ id: S_1, programId: P_A }],
      semesters: [{ id: 'sem-1', programId: P_B }],
    });
    await expect(
      service.create(
        { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        ADMIN_SCOPE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a section for a subject without an academic program', async () => {
    const service = makeService({ subjects: [{ id: S_1, programId: null }] });
    await expect(
      service.create(
        { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        ADMIN_SCOPE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown semester', async () => {
    const service = makeService({
      subjects: [{ id: S_1, programId: P_A }],
      semesters: [],
    });
    await expect(
      service.create(
        { semesterId: 'ghost', subjectId: S_1, professorId: PROF, code: 'X' } as never,
        ADMIN_SCOPE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an update that moves a section into a semester of another program', async () => {
    const service = makeService({
      section: makeSection({ subjectId: S_1, semesterId: 'sem-1' }),
      subjects: [{ id: S_1, programId: P_A }],
      semesters: [
        { id: 'sem-1', programId: P_A },
        { id: 'sem-2', programId: P_B },
      ],
    });
    await expect(
      service.update(SEC_1, { semesterId: 'sem-2' } as never, ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an unrelated update without re-validating the legacy pairing', async () => {
    const service = makeService({
      section: makeSection({ subjectId: S_1, semesterId: 'sem-1' }),
      subjects: [{ id: S_1, programId: P_A }],
      semesters: [{ id: 'sem-1', programId: P_A }],
    });
    const updated = await service.update(SEC_1, { location: 'Room 2' } as never, ADMIN_SCOPE);
    expect(updated.location).toBe('Room 2');
  });
});

describe('SectionsService primary professor rules', () => {
  it('requires a primary professor on creation', async () => {
    const service = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    await expect(
      service.create({ semesterId: 'sem-1', subjectId: S_1, code: 'X' } as never, ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows one professor to teach multiple classes', async () => {
    const service = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    const first = await service.create(
      { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'C1' } as never,
      ADMIN_SCOPE,
    );
    const second = await service.create(
      { semesterId: 'sem-1', subjectId: S_1, professorId: PROF, code: 'C2' } as never,
      ADMIN_SCOPE,
    );
    expect(first.professorId).toBe(PROF);
    expect(second.professorId).toBe(PROF);
    expect(second.code).toBe('C2');
  });
});
