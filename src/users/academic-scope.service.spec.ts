import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import { User } from './entities/user.entity.js';
import { AcademicScopeService } from './academic-scope.service.js';

const P_A = '00000000-0000-4000-8000-00000000000a';
const STU_1 = '00000000-0000-4000-8000-0000000000u1';
const S_1 = '00000000-0000-4000-8000-000000000001';

function actor(role: UserRole, id = STU_1): AuthenticatedUser {
  return { id, email: `${id}@example.test`, role } as AuthenticatedUser;
}

interface HarnessOverrides {
  user?: Partial<User> | null;
  assignments?: Array<{ subjectId: string }>;
}

function makeService(overrides: HarnessOverrides = {}) {
  const users = {
    findOne: async () => (overrides.user === undefined ? null : overrides.user),
  } as unknown as Repository<User>;
  const assignments = {
    find: async () => overrides.assignments ?? [],
  } as unknown as Repository<SubjectManagerAssignment>;
  return new AcademicScopeService(users, assignments);
}

describe('AcademicScopeService.resolve', () => {
  it('gives admins an unrestricted scope without a database lookup', async () => {
    const service = makeService();
    const scope = await service.resolve(actor(UserRole.ADMIN));
    expect(scope).toEqual({
      userId: STU_1,
      role: UserRole.ADMIN,
      programId: null,
      assignedSubjectIds: [],
    });
  });

  it('resolves a student scope from their database program (never the client)', async () => {
    const service = makeService({ user: { id: STU_1, role: UserRole.STUDENT, programId: P_A } });
    const scope = await service.resolve(actor(UserRole.STUDENT));
    expect(scope.role).toBe(UserRole.STUDENT);
    expect(scope.programId).toBe(P_A);
    expect(scope.assignedSubjectIds).toEqual([]);
  });

  it('resolves a student with no program to a null (empty) scope', async () => {
    const service = makeService({ user: { id: STU_1, role: UserRole.STUDENT, programId: null } });
    const scope = await service.resolve(actor(UserRole.STUDENT));
    expect(scope.programId).toBeNull();
  });

  it('resolves a Subject Manager with program and explicit assignments', async () => {
    const service = makeService({
      user: { id: STU_1, role: UserRole.SUBJECT_MANAGER, programId: P_A },
      assignments: [{ subjectId: S_1 }],
    });
    const scope = await service.resolve(actor(UserRole.SUBJECT_MANAGER));
    expect(scope.programId).toBe(P_A);
    expect(scope.assignedSubjectIds).toEqual([S_1]);
  });

  it('throws NotFound when the account disappeared between token check and scope read', async () => {
    const service = makeService({ user: null });
    await expect(service.resolve(actor(UserRole.STUDENT))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
