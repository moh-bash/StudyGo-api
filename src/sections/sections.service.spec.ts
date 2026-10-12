import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const ADMIN_SCOPE: ResolvedScope = {
  userId: 'admin-1',
  role: UserRole.ADMIN,
  programId: null,
  assignedSubjectIds: [],
};

function subjectManagerScope(assigned: string[] = [S_1]): ResolvedScope {
  return { userId: 'sm-1', role: UserRole.SUBJECT_MANAGER, programId: P_A, assignedSubjectIds: assigned };
}

function programManagerScope(): ResolvedScope {
  return { userId: 'pm-1', role: UserRole.PROGRAM_MANAGER, programId: P_A, assignedSubjectIds: [] };
}

interface HarnessOverrides {
  section?: AcademicSection | null;
  subjects?: Array<Partial<Subject>>;
}

function makeSection(overrides: Partial<AcademicSection> = {}): AcademicSection {
  return {
    id: SEC_1,
    semesterId: 'sem-1',
    subjectId: S_1,
    professorId: null,
    code: 'SEC-A',
    location: null,
    deliveryMode: null,
    capacity: null,
    isActive: true,
    ...overrides,
  } as AcademicSection;
}

function makeService(overrides: HarnessOverrides = {}) {
  const section = overrides.section === undefined ? makeSection() : overrides.section;
  const subjects = overrides.subjects ?? [];
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
  const semesters = { exists: async () => true } as unknown as Repository<Semester>;
  const subjectRepo = {
    findOne: async ({ where }: { where: { id: string } }) =>
      (subjects.find((s) => s.id === where.id) ?? null) as Subject | null,
  } as unknown as Repository<Subject>;
  const professors = { exists: async () => true } as unknown as Repository<Professor>;
  return new SectionsService(sections, schedules, semesters, subjectRepo, professors);
}

describe('SectionsService scope enforcement', () => {
  it('admin may create a section for any existing subject', async () => {
    const service = makeService({ subjects: [{ id: S_1 }] });
    const created = await service.create(
      { semesterId: 'sem-1', subjectId: S_1, code: 'X' } as never,
      ADMIN_SCOPE,
    );
    expect(created.subjectId).toBe(S_1);
  });

  it('admin still gets a 400 for a nonexistent subject', async () => {
    const service = makeService({ subjects: [] });
    await expect(
      service.create({ semesterId: 'sem-1', subjectId: S_1, code: 'X' } as never, ADMIN_SCOPE),
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
      { semesterId: 'sem-1', subjectId: S_1, code: 'X' } as never,
      subjectManagerScope([S_1]),
    );
    expect(created.subjectId).toBe(S_1);

    await expect(
      service.create({ semesterId: 'sem-1', subjectId: S_2, code: 'Y' } as never, subjectManagerScope([S_1])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a Program Manager may create a section only inside their program', async () => {
    const inProgram = makeService({ subjects: [{ id: S_1, programId: P_A }] });
    await expect(
      inProgram.create({ semesterId: 'sem-1', subjectId: S_1, code: 'X' } as never, programManagerScope()),
    ).resolves.toBeTruthy();

    const outOfProgram = makeService({ subjects: [{ id: S_2, programId: P_B }] });
    await expect(
      outOfProgram.create({ semesterId: 'sem-1', subjectId: S_2, code: 'X' } as never, programManagerScope()),
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
