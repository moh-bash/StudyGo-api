import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import type { CreateSubjectDto } from './dto/create-subject.dto.js';
import { Subject } from './entities/subject.entity.js';
import { SubjectsService } from './subjects.service.js';

const SUBJECT_ID = 'subj-1';
const OTHER_ID = 'subj-2';

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

interface ServiceOverrides {
  save?: (subject: Subject) => Promise<Subject>;
  programExists?: boolean;
  stored?: Subject[];
}

function makeService(overrides: ServiceOverrides = {}) {
  const stored = overrides.stored ?? [makeSubject()];
  const subjects: Partial<Repository<Subject>> = {
    create: (data) => ({ ...data, prerequisites: [] }) as Subject,
    save: async (subject) => overrides.save?.(subject as Subject) ?? subject,
    findOne: async ({ where }) => {
      const id = (where as { id?: string }).id;
      return stored.find((s) => s.id === id) ?? null;
    },
    find: async ({ where }) => {
      const raw = (where as { id?: unknown }).id;
      const ids = Array.isArray((raw as { _value?: string[] })?._value)
        ? (raw as { _value: string[] })._value
        : [raw];
      return stored.filter((s) => ids.includes(s.id));
    },
    remove: async (subject) => subject,
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
  it('defaults weights to 0/100 when none are provided', async () => {
    const service = makeService();
    const saved = await service.create(createDto());
    expect(saved.projectWeight).toBe(0);
    expect(saved.examWeight).toBe(100);
    expect(saved.isActive).toBe(true);
    expect(saved.description).toBeNull();
    expect(saved.programId).toBeNull();
  });

  it('keeps provided weights when they sum to 100', async () => {
    const service = makeService();
    const saved = await service.create(createDto({ projectWeight: 50, examWeight: 50 }));
    expect(saved.projectWeight).toBe(50);
    expect(saved.examWeight).toBe(50);
  });

  it('requires both weights together', async () => {
    const service = makeService();
    await expect(service.create(createDto({ projectWeight: 50 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects weights that do not sum to 100', async () => {
    const service = makeService();
    await expect(
      service.create(createDto({ projectWeight: 40, examWeight: 50 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unique-code violations to a BadRequestException', async () => {
    const service = makeService({ save: async () => Promise.reject({ code: '23505' }) });
    await expect(service.create(createDto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown department/program reference', async () => {
    const service = makeService({ programExists: false });
    await expect(
      service.create(createDto({ programId: 'missing' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SubjectsService.findOne', () => {
  it('throws NotFoundException for an unknown id', async () => {
    const service = makeService({ stored: [] });
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubjectsService prerequisites', () => {
  it('rejects a subject as its own prerequisite', async () => {
    const service = makeService();
    await expect(service.setPrerequisites(SUBJECT_ID, [SUBJECT_ID])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects prerequisite ids that do not exist', async () => {
    const service = makeService();
    await expect(service.setPrerequisites(SUBJECT_ID, ['ghost'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assigns existing prerequisites', async () => {
    const service = makeService({ stored: [makeSubject(), makeSubject({ id: OTHER_ID })] });
    const result = await service.setPrerequisites(SUBJECT_ID, [OTHER_ID]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(OTHER_ID);
  });

  it('deduplicates prerequisite ids', async () => {
    const service = makeService({ stored: [makeSubject(), makeSubject({ id: OTHER_ID })] });
    const result = await service.setPrerequisites(SUBJECT_ID, [OTHER_ID, OTHER_ID]);
    expect(result).toHaveLength(1);
  });
});