import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { UserRole } from '../common/enums.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { StudentEnrollment } from './entities/enrollment.entity.js';
import { EnrollmentsService } from './enrollments.service.js';

const P_A = '00000000-0000-4000-8000-00000000000a';
const P_B = '00000000-0000-4000-8000-00000000000b';
const SEC_1 = '00000000-0000-4000-8000-0000000000c1';
const STU_1 = '00000000-0000-4000-8000-0000000000u1';

function actor(role: UserRole, id = STU_1): AuthenticatedUser {
  return { id, email: `${id}@example.test`, role } as AuthenticatedUser;
}

function studentUser(programId: string | null) {
  return { id: STU_1, programId } as User;
}

interface HarnessOverrides {
  sectionProgramId?: string | null;
  studentProgramId?: string | null;
  sectionMissing?: boolean;
  inactiveSection?: boolean;
}

function makeService(overrides: HarnessOverrides = {}) {
  const sectionProgramId = 'sectionProgramId' in overrides ? overrides.sectionProgramId : P_A;
  const studentProgramId = 'studentProgramId' in overrides ? overrides.studentProgramId : P_A;
  const section = overrides.sectionMissing
    ? null
    : ({
        id: SEC_1,
        subjectId: 'subj-1',
        isActive: overrides.inactiveSection ? false : true,
        capacity: null,
        subject: { id: 'subj-1', programId: sectionProgramId },
      } as unknown as AcademicSection);
  const sections = {
    findOne: async () => section,
  } as unknown as Repository<AcademicSection>;
  const enrollments = {
    count: async () => 0,
    find: async () => [],
    findOne: async () => null,
    create: (data: Partial<StudentEnrollment>) => ({ ...data }) as StudentEnrollment,
    save: async (e: StudentEnrollment) => e,
  } as unknown as Repository<StudentEnrollment>;
  const subjects = {
    findOne: async () => ({ id: 'subj-1', prerequisites: [] }) as Subject,
  } as unknown as Repository<Subject>;
  const users = {
    findOne: async () => studentUser(studentProgramId),
  } as unknown as Repository<User>;
  return new EnrollmentsService(enrollments, sections, subjects, users);
}

describe('EnrollmentsService program scoping (audit F-03, narrow fix)', () => {
  it('allows a student to enroll in a section of their own program', async () => {
    const service = makeService({ sectionProgramId: P_A, studentProgramId: P_A });
    const enrollment = await service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never);
    expect(enrollment.sectionId).toBe(SEC_1);
    expect(enrollment.studentId).toBe(STU_1);
  });

  it('rejects a cross-program enrollment by a student', async () => {
    const service = makeService({ sectionProgramId: P_B, studentProgramId: P_A });
    await expect(
      service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects enrollment when the student has no academic program', async () => {
    const service = makeService({ sectionProgramId: P_A, studentProgramId: null });
    await expect(
      service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects enrollment into a subject without an academic program', async () => {
    const service = makeService({ sectionProgramId: null, studentProgramId: P_A });
    await expect(
      service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('an admin may enroll a student regardless of program boundaries', async () => {
    const service = makeService({ sectionProgramId: P_B, studentProgramId: P_A });
    const enrollment = await service.create(actor(UserRole.ADMIN, 'admin-1'), {
      sectionId: SEC_1,
      studentId: STU_1,
    } as never);
    expect(enrollment.studentId).toBe(STU_1);
  });

  it('still rejects enrollment into a missing section', async () => {
    const service = makeService({ sectionMissing: true });
    await expect(
      service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still rejects enrollment into an inactive section', async () => {
    const service = makeService({ inactiveSection: true });
    await expect(
      service.create(actor(UserRole.STUDENT), { sectionId: SEC_1 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
