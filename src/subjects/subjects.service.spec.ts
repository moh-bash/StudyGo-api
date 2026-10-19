import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import type { ResolvedScope } from '../users/academic-scope.js';
import type { CreateSubjectDto } from './dto/create-subject.dto.js';
import { Subject } from './entities/subject.entity.js';
import { SubjectsService } from './subjects.service.js';

const SUBJECT_ID = 'subj-1';
const OTHER_ID = 'subj-2';
const P_A = '00000000-0000-4000-8000-00000000000a';
const P_B = '00000000-0000-4000-8000-00000000000b';

const ADMIN_SCOPE: ResolvedScope = {
  userId: 'admin-1',
  role: UserRole.ADMIN,
  programId: null,
  assignedSubjectIds: [],
};

function managerScope(overrides: Partial<ResolvedScope> = {}): ResolvedScope {
  return {
    userId: 'mgr-1',
    role: UserRole.SUBJECT_MANAGER,
    programId: P_A,
    assignedSubjectIds: [SUBJECT_ID],
    ...overrides,
  };
}

function programManagerScope(overrides: Partial<ResolvedScope> = {}): ResolvedScope {
  return {
    userId: 'pm-1',
    role: UserRole.PROGRAM_MANAGER,
    programId: P_A,
    assignedSubjectIds: [],
    ...overrides,
  };
}

function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: SUBJECT_ID,
    code: 'CS101',
    nameEn: 'Intro to CS',
    nameAr: 'مقدمة في علوم الحاسب',
    description: null,
    creditHours: 3,
    projectWeight: 0,
    examWeight: 100,
    programId: null,
    isActive: true,
    program: null,
    prerequisites: [],
    ...overrides,
  } as Subject;
}

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

interface ServiceOverrides {
  save?: (subject: Subject) => Promise<Subject>;
  programExists?: boolean;
  stored?: Subject[];
}

function makeService(overrides: ServiceOverrides = {}) {
  const stored = overrides.stored ?? [makeSubject()];
  const subjects: Partial<Repository<Subject>> = {
    create: ((data: any) => ({ ...data, prerequisites: [] }) as Subject) as any,
    save: async (subject: any) => overrides.save?.(subject as Subject) ?? subject,
    findOne: async ({ where }: any = {}) => {
      const id = (where as { id?: string }).id;
      return stored.find((s) => s.id === id) ?? null;
    },
    find: async ({ where }: any = {}) => {
      const raw = (where as { id?: unknown }).id;
      const ids = Array.isArray((raw as { _value?: string[] })?._value)
        ? (raw as { _value: string[] })._value
        : [raw];
      return stored.filter((s) => ids.includes(s.id));
    },
    remove: async (subject: any) => subject,
  };
  const programs: Partial<Repository<AcademicProgram>> = {
    exists: async () => overrides.programExists ?? true,
  };
  return new SubjectsService(subjects as Repository<Subject>, programs as Repository<AcademicProgram>);
}

function createDto(overrides: Partial<CreateSubjectDto> = {}): CreateSubjectDto {
  return {
    code: 'CS101',
    nameEn: 'Intro to CS',
    nameAr: 'مقدمة',
    creditHours: 3,
    ...overrides,
  } as CreateSubjectDto;
}

describe('SubjectsService.create', () => {
  it('defaults weights to 25/75 when none are provided', async () => {
    const service = makeService();
    const saved = await service.create(createDto(), ADMIN_SCOPE);
    expect(saved.projectWeight).toBe(25);
    expect(saved.examWeight).toBe(75);
    expect(saved.isActive).toBe(true);
    expect(saved.description).toBeNull();
    expect(saved.programId).toBeNull();
  });

  it('keeps provided weights when they sum to 100', async () => {
    const service = makeService();
    const saved = await service.create(createDto({ projectWeight: 50, examWeight: 50 }), ADMIN_SCOPE);
    expect(saved.projectWeight).toBe(50);
    expect(saved.examWeight).toBe(50);
  });

  it('requires both weights together', async () => {
    const service = makeService();
    await expect(
      service.create(createDto({ projectWeight: 50 }), ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects weights that do not sum to 100', async () => {
    const service = makeService();
    await expect(
      service.create(createDto({ projectWeight: 40, examWeight: 50 }), ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unique-code violations to a BadRequestException', async () => {
    const service = makeService({ save: async () => Promise.reject({ code: '23505' }) });
    await expect(service.create(createDto(), ADMIN_SCOPE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an unknown department/program reference', async () => {
    const service = makeService({ programExists: false });
    await expect(
      service.create(createDto({ programId: 'missing' }), ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SubjectsService.findOne', () => {
  it('throws NotFoundException for an unknown id', async () => {
    const service = makeService({ stored: [] });
    await expect(service.findOne('nope', ADMIN_SCOPE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubjectsService prerequisites', () => {
  it('rejects a subject as its own prerequisite', async () => {
    const service = makeService();
    await expect(
      service.setPrerequisites(SUBJECT_ID, [SUBJECT_ID], ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects prerequisite ids that do not exist', async () => {
    const service = makeService();
    await expect(
      service.setPrerequisites(SUBJECT_ID, ['ghost'], ADMIN_SCOPE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns existing prerequisites', async () => {
    const service = makeService({ stored: [makeSubject(), makeSubject({ id: OTHER_ID })] });
    const result = await service.setPrerequisites(SUBJECT_ID, [OTHER_ID], ADMIN_SCOPE);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(OTHER_ID);
  });

  it('deduplicates prerequisite ids', async () => {
    const service = makeService({ stored: [makeSubject(), makeSubject({ id: OTHER_ID })] });
    const result = await service.setPrerequisites(SUBJECT_ID, [OTHER_ID, OTHER_ID], ADMIN_SCOPE);
    expect(result).toHaveLength(1);
  });
});

describe('SubjectsService student scope (audit F-03)', () => {
  const STUDENT_SCOPE: ResolvedScope = {
    userId: 'stu-1',
    role: UserRole.STUDENT,
    programId: P_A,
    assignedSubjectIds: [],
  };
  const UNPROGRAMMED_STUDENT: ResolvedScope = { ...STUDENT_SCOPE, programId: null };

  it('allows a student to read a subject of their own program', async () => {
    const service = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })] });
    const subject = await service.findOne(SUBJECT_ID, STUDENT_SCOPE);
    expect(subject.id).toBe(SUBJECT_ID);
  });

  it('hides a subject of another specialization from a student (404, not 403)', async () => {
    const service = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_B })] });
    await expect(service.findOne(SUBJECT_ID, STUDENT_SCOPE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hides an unprogrammed subject from every student', async () => {
    const service = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: null })] });
    await expect(service.findOne(SUBJECT_ID, STUDENT_SCOPE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a student with no academic program reads nothing', async () => {
    const service = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })] });
    await expect(service.findOne(SUBJECT_ID, UNPROGRAMMED_STUDENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies the program filter to a student list query (client filter cannot widen scope)', async () => {
    const service = makeService();
    const { calls, qb } = makeQbHarness();
    (service as unknown as { subjects: { createQueryBuilder: () => unknown } }).subjects = {
      createQueryBuilder: () => qb,
    };
    await service.findAll(
      { page: 1, limit: 20, programId: P_B } as never,
      STUDENT_SCOPE,
    );
    // The scope filter AND-combines with the client filter: the request stays
    // pinned to the student's own program even when another is requested.
    expect(calls.some((c) => c.includes('subject.programId = :scopeProgramId'))).toBe(true);
    expect(calls.some((c) => c.includes('subject.programId = :programId'))).toBe(true);
  });

  it('empties the student list query when the student has no program', async () => {
    const service = makeService();
    const { calls, qb } = makeQbHarness();
    (service as unknown as { subjects: { createQueryBuilder: () => unknown } }).subjects = {
      createQueryBuilder: () => qb,
    };
    await service.findAll({ page: 1, limit: 20 } as never, UNPROGRAMMED_STUDENT);
    expect(calls).toContainEqual('andWhere:1 = 0');
  });

  it('rejects a student attempting to read prerequisites of an out-of-scope subject', async () => {
    const service = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_B })] });
    await expect(service.getPrerequisites(SUBJECT_ID, STUDENT_SCOPE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SubjectsService manager scope', () => {
  it('forces a Subject Manager subject into their own program and rejects other programs', async () => {
    const service = makeService();
    const created = await service.create(createDto(), managerScope());
    expect(created.programId).toBe(P_A);

    await expect(
      service.create(createDto({ programId: P_B }), managerScope()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create when a manager has no program', async () => {
    const service = makeService();
    await expect(
      service.create(createDto(), managerScope({ programId: null })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides subjects a Subject Manager is not assigned (404, not 403)', async () => {
    const service = makeService({
      stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })],
    });
    await expect(
      service.findOne(SUBJECT_ID, managerScope({ assignedSubjectIds: [OTHER_ID] })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a Subject Manager to read an assigned subject in their program', async () => {
    const service = makeService({
      stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })],
    });
    const subject = await service.findOne(SUBJECT_ID, managerScope());
    expect(subject.id).toBe(SUBJECT_ID);
  });

  it('limits a Program Manager to their own program', async () => {
    const inProgram = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })] });
    expect((await inProgram.findOne(SUBJECT_ID, programManagerScope())).id).toBe(SUBJECT_ID);

    const outOfProgram = makeService({ stored: [makeSubject({ id: SUBJECT_ID, programId: P_B })] });
    await expect(
      outOfProgram.findOne(SUBJECT_ID, programManagerScope()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never treats an unprogrammed subject as within a manager scope', async () => {
    const service = makeService({
      stored: [makeSubject({ id: SUBJECT_ID, programId: null })],
    });
    await expect(
      service.findOne(SUBJECT_ID, programManagerScope()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents a manager from moving a subject to another program', async () => {
    const service = makeService({
      stored: [makeSubject({ id: SUBJECT_ID, programId: P_A })],
    });
    await expect(
      service.update(SUBJECT_ID, { programId: P_B }, managerScope()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a prerequisite outside the manager scope', async () => {
    const service = makeService({
      stored: [
        makeSubject({ id: SUBJECT_ID, programId: P_A }),
        makeSubject({ id: OTHER_ID, programId: P_B }),
      ],
    });
    await expect(
      service.setPrerequisites(SUBJECT_ID, [OTHER_ID], managerScope()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
