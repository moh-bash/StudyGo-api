import { FindOperator, type Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { DeliveryMode, SemesterStatus, UserRole, Weekday } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { SectionSchedule } from '../sections/entities/section-schedule.entity.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CatalogService } from './catalog.service.js';

const PROGRAM_A = 'program-a';
const PROGRAM_B = 'program-b';
const STUDENT: AuthenticatedUser = {
  id: 'student-1',
  email: 'student@studygo.example',
  role: UserRole.STUDENT,
};

type Where = Record<string, unknown>;

function inValues(value: unknown): string[] {
  const raw = (value as { _value?: unknown })._value;
  return Array.isArray(raw) ? (raw as string[]) : [];
}

function matches(row: Record<string, unknown>, where: Where): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      if (!inValues(expected).includes(actual as string)) {
        return false;
      }
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/** Fake repository that honours `where` equality / `In(...)` and records calls. */
function repo<T extends object>(rows: T[], calls: string[], name: string): Repository<T> {
  const asRow = (row: T) => row as unknown as Record<string, unknown>;
  return {
    find: async (options?: { where?: Where }) => {
      calls.push(name);
      const where = options?.where ?? {};
      return rows.filter((row) => matches(asRow(row), where));
    },
    findOne: async (options?: { where?: Where }) => {
      calls.push(name);
      const where = options?.where ?? {};
      return rows.find((row) => matches(asRow(row), where)) ?? null;
    },
  } as unknown as Repository<T>;
}

interface Fixture {
  service: CatalogService;
  calls: string[];
}

function makeService(program: AcademicProgram | null = programA()): Fixture {
  const calls: string[] = [];

  const owner = { id: STUDENT.id, program } as unknown as User;
  const subjects = [
    subject({ id: 'sub-a1', code: 'A1', programId: PROGRAM_A, prerequisites: [{ id: 'sub-a2' }] }),
    subject({ id: 'sub-a2', code: 'A2', programId: PROGRAM_A }),
    subject({ id: 'sub-a-inactive', code: 'A3', programId: PROGRAM_A, isActive: false }),
    subject({ id: 'sub-b1', code: 'B1', programId: PROGRAM_B }),
    subject({ id: 'sub-none', code: 'N1', programId: null }),
  ];
  const semesters = [
    semester({ id: 'sem-a', programId: PROGRAM_A }),
    semester({ id: 'sem-b', programId: PROGRAM_B }),
  ];
  const sections = [
    section({ id: 'sec-a1', subjectId: 'sub-a1', semesterId: 'sem-a', professorId: 'prof-1' }),
    section({ id: 'sec-a2', subjectId: 'sub-a2', semesterId: 'sem-a', professorId: null }),
    // excluded: semester belongs to program B
    section({ id: 'sec-wrong-sem', subjectId: 'sub-a1', semesterId: 'sem-b', professorId: 'prof-1' }),
    // excluded: subject belongs to program B
    section({ id: 'sec-wrong-sub', subjectId: 'sub-b1', semesterId: 'sem-a', professorId: 'prof-1' }),
    // excluded: inactive
    section({ id: 'sec-inactive', subjectId: 'sub-a1', semesterId: 'sem-a', isActive: false }),
  ];
  const professors = [
    professor({ id: 'prof-1', name: 'Prof One' }),
    professor({ id: 'prof-2', name: 'Prof Two' }),
  ];
  const schedules = [
    schedule({ id: 'sch-a1', sectionId: 'sec-a1' }),
    schedule({ id: 'sch-a2', sectionId: 'sec-a2' }),
    schedule({ id: 'sch-wrong', sectionId: 'sec-wrong-sub' }),
  ];

  const service = new CatalogService(
    repo([owner], calls, 'users'),
    repo(subjects, calls, 'subjects') as unknown as Repository<Subject>,
    repo(semesters, calls, 'semesters') as unknown as Repository<Semester>,
    repo(sections, calls, 'sections') as unknown as Repository<AcademicSection>,
    repo(professors, calls, 'professors') as unknown as Repository<Professor>,
    repo(schedules, calls, 'schedules') as unknown as Repository<SectionSchedule>,
  );

  return { service, calls };
}

describe('CatalogService.getCatalogForUser', () => {
  it("returns the caller's program and only that program's active records", async () => {
    const { service } = makeService();
    const catalog = await service.getCatalogForUser(STUDENT);

    expect(catalog.program?.id).toBe(PROGRAM_A);
    expect(catalog.subjects.map((s) => s.id)).toEqual(['sub-a1', 'sub-a2']);
    expect(catalog.semesters.map((s) => s.id)).toEqual(['sem-a']);
    expect(catalog.sections.map((s) => s.id)).toEqual(['sec-a1', 'sec-a2']);
    expect(catalog.professors.map((p) => p.id)).toEqual(['prof-1']);
    expect(catalog.schedules.map((s) => s.id)).toEqual(['sch-a1', 'sch-a2']);
  });

  it('never returns records from another program, an inactive record, or an unprogrammed subject', async () => {
    const { service } = makeService();
    const catalog = await service.getCatalogForUser(STUDENT);

    expect(catalog.subjects.some((s) => s.programId !== PROGRAM_A)).toBe(false);
    expect(catalog.subjects.some((s) => s.code === 'A3')).toBe(false);
    expect(catalog.semesters.some((s) => s.id === 'sem-b')).toBe(false);
    expect(catalog.sections.some((s) => s.id === 'sec-wrong-sem')).toBe(false);
    expect(catalog.sections.some((s) => s.id === 'sec-wrong-sub')).toBe(false);
    expect(catalog.sections.some((s) => s.id === 'sec-inactive')).toBe(false);
    expect(catalog.schedules.some((s) => s.id === 'sch-wrong')).toBe(false);
  });

  it('maps prerequisite subject ids onto each subject', async () => {
    const { service } = makeService();
    const catalog = await service.getCatalogForUser(STUDENT);
    const first = catalog.subjects.find((s) => s.id === 'sub-a1');
    expect(first?.prerequisiteIds).toEqual(['sub-a2']);
  });

  it('exposes exactly the documented fields with canonical ids', async () => {
    const { service } = makeService();
    const catalog = await service.getCatalogForUser(STUDENT);

    expect(Object.keys(catalog.program ?? {}).sort()).toEqual(['code', 'id', 'name']);
    const subject = catalog.subjects[0];
    expect(Object.keys(subject).sort()).toEqual([
      'code',
      'creditHours',
      'examWeight',
      'id',
      'nameAr',
      'nameEn',
      'prerequisiteIds',
      'programId',
      'projectWeight',
    ]);
    expect(Object.keys(catalog.sections[0]).sort()).toEqual([
      'capacity',
      'code',
      'deliveryMode',
      'id',
      'location',
      'professorId',
      'semesterId',
      'subjectId',
    ]);
  });

  it('returns an empty catalog (and stops early) when the user has no program', async () => {
    const { service, calls } = makeService(null);
    const catalog = await service.getCatalogForUser(STUDENT);

    expect(catalog).toEqual({
      program: null,
      semesters: [],
      subjects: [],
      professors: [],
      sections: [],
      schedules: [],
    });
    // Only the identity lookup ran; no catalog queries were issued.
    expect(calls).toEqual(['users']);
  });

  it('returns an empty catalog when the user cannot be found', async () => {
    const empty = new CatalogService(
      repo([], [] as string[], 'users') as unknown as Repository<User>,
      repo([], [] as string[], 'subjects') as unknown as Repository<Subject>,
      repo([], [] as string[], 'semesters') as unknown as Repository<Semester>,
      repo([], [] as string[], 'sections') as unknown as Repository<AcademicSection>,
      repo([], [] as string[], 'professors') as unknown as Repository<Professor>,
      repo([], [] as string[], 'schedules') as unknown as Repository<SectionSchedule>,
    );
    const catalog = await empty.getCatalogForUser(STUDENT);
    expect(catalog.program).toBeNull();
    expect(catalog.subjects).toEqual([]);
  });

  it('issues a fixed number of queries (no per-record N+1)', async () => {
    const { service, calls } = makeService();
    await service.getCatalogForUser(STUDENT);
    const count = (name: string) => calls.filter((call) => call === name).length;
    expect(count('users')).toBe(1);
    expect(count('subjects')).toBe(1);
    expect(count('semesters')).toBe(1);
    expect(count('sections')).toBe(1);
    expect(count('professors')).toBe(1);
    expect(count('schedules')).toBe(1);
  });
});

function programA(): AcademicProgram {
  return { id: PROGRAM_A, name: 'Program A', code: 'PA' } as AcademicProgram;
}

function subject(overrides: Partial<Subject>): Subject {
  return {
    id: 'subject',
    code: 'CODE',
    nameEn: 'Name EN',
    nameAr: 'اسم',
    description: null,
    creditHours: 3,
    projectWeight: 0,
    examWeight: 100,
    programId: PROGRAM_A,
    isActive: true,
    prerequisites: [],
    ...overrides,
  } as Subject;
}

function semester(overrides: Partial<Semester>): Semester {
  return {
    id: 'sem',
    programId: PROGRAM_A,
    name: 'First Semester',
    code: 'S1',
    startDate: '2026-02-01',
    endDate: '2026-06-15',
    status: SemesterStatus.ACTIVE,
    ...overrides,
  } as Semester;
}

function section(overrides: Partial<AcademicSection>): AcademicSection {
  return {
    id: 'sec',
    semesterId: 'sem-a',
    subjectId: 'sub-a1',
    professorId: null,
    code: '01',
    location: null,
    deliveryMode: DeliveryMode.ON_CAMPUS,
    capacity: 40,
    isActive: true,
    ...overrides,
  } as AcademicSection;
}

function professor(overrides: Partial<Professor>): Professor {
  return {
    id: 'prof',
    name: 'Prof',
    email: null,
    profileImageUrl: null,
    description: null,
    isActive: true,
    ...overrides,
  } as Professor;
}

function schedule(overrides: Partial<SectionSchedule>): SectionSchedule {
  return {
    id: 'sch',
    sectionId: 'sec-a1',
    dayOfWeek: Weekday.SUNDAY,
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: null,
    ...overrides,
  } as SectionSchedule;
}
