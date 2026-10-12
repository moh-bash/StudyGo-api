import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AccountStatus, UserRole } from '../common/enums.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import type { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

const P_A = '00000000-0000-4000-8000-00000000000a';
const P_B = '00000000-0000-4000-8000-00000000000b';
const S_1 = '00000000-0000-4000-8000-000000000001';
const S_2 = '00000000-0000-4000-8000-000000000002';
const MIA = '00000000-0000-4000-8000-000000000099';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    fullName: 'Layla Haddad',
    email: 'layla@example.com',
    role: UserRole.STUDENT,
    status: AccountStatus.ACTIVE,
    profileImageUrl: null,
    studentUniversityId: null,
    programId: null,
    ...overrides,
  } as User;
}

function makeSubject(id: string, programId: string | null): Subject {
  return { id, programId } as Subject;
}

interface HarnessOverrides {
  user?: User;
  program?: AcademicProgram | null;
  subjects?: Subject[];
}

/** Real service + in-memory repos. The transaction manager reuses the store. */
function makeService(overrides: HarnessOverrides = {}) {
  const store: { assignments: Array<{ userId: string; subjectId: string }> } = {
    assignments: [],
  };
  const user = overrides.user ?? makeUser();
  let savedUser: User | undefined;
  let saved: Array<User | SubjectManagerAssignment> = [];

  const users = {
    findOne: async () => user,
    save: async (_u: User) => {
      savedUser = { ...user, ..._u };
      saved.push(_u);
      return _u;
    },
  } as unknown as Repository<User>;
  const refreshTokens = {
    update: async () => ({ affected: 0, raw: {}, generatedMaps: [] }),
  } as unknown as Repository<RefreshToken>;
  const programs = {
    findOne: async () => overrides.program ?? null,
  } as unknown as Repository<AcademicProgram>;
  const subjects = {
    find: async ({ where }: { where?: { id?: unknown } } = {}) =>
      (overrides.subjects ?? []).filter(
        (s) => !where?.id || !Array.isArray(where.id) || where.id.includes(s.id),
      ),
  } as unknown as Repository<Subject>;
  const assignments = {
    find: async ({ where }: { where?: { userId?: string } } = {}) =>
      store.assignments
        .filter((a) => !where?.userId || a.userId === where.userId)
        .map((a) => ({ ...a, createdAt: new Date() }) as SubjectManagerAssignment),
    delete: async (criteria: { userId?: string; subjectId?: string }) => {
      const before = store.assignments.length;
      store.assignments = store.assignments.filter(
        (a) =>
          a.userId !== criteria.userId ||
          (criteria.subjectId !== undefined && a.subjectId !== criteria.subjectId),
      );
      return { affected: before - store.assignments.length, raw: {}, generatedMaps: [] };
    },
    count: async ({ where }: { where?: { userId?: string } } = {}) =>
      store.assignments.filter((a) => !where?.userId || a.userId === where.userId).length,
    create: (_target: unknown, attrs: { userId: string; subjectId: string }) => attrs,
    save: async (rows: SubjectManagerAssignment | SubjectManagerAssignment[]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const row of list) {
        // Only actual assignment rows (both ids present) enter the store; a
        // saved User entity (e.g. the STUDENT downgrade) is not an assignment.
        if (typeof (row as unknown as { subjectId?: unknown }).subjectId !== 'string') continue;
        const exists = store.assignments.some(
          (a) => a.userId === row.userId && a.subjectId === row.subjectId,
        );
        if (!exists) store.assignments.push({ userId: row.userId, subjectId: row.subjectId });
      }
      saved.push(...list);
      return rows;
    },
  } as unknown as Repository<SubjectManagerAssignment>;
  const dataSource = {
    transaction: async <T>(run: (manager: unknown) => Promise<T>): Promise<T> => {
      const manager = {
        delete: async (_entity: unknown, criteria: { userId?: string; subjectId?: string }) =>
          assignments.delete(criteria),
        count: async (_entity: unknown, options: { where?: { userId?: string } }) =>
          assignments.count(options),
        create: (_entity: unknown, attrs: { userId: string; subjectId: string }) => attrs,
        save: assignments.save,
      };
      return run(manager);
    },
  } as unknown as DataSource;

  const service = new UsersService(users, refreshTokens, programs, subjects, assignments, dataSource);
  return {
    service,
    saveUser: (_u: User) => user,
    store,
    getSavedUser: () => savedUser,
  };
}

describe('UsersService academic assignments (Program Manager)', () => {
  it('assigns a program manager: role and program set together, scope exposed', async () => {
    const { service } = makeService({ program: { id: P_A } as AcademicProgram });
    const result = await service.assignProgramManager('user-1', P_A);
    expect(result.role).toBe(UserRole.PROGRAM_MANAGER);
    expect(result.programId).toBe(P_A);
    expect(result.managedProgramId).toBe(P_A);
    expect(result.managedSubjectIds).toEqual([]);
  });

  it('rejects a nonexistent program', async () => {
    const { service } = makeService({ program: null });
    await expect(service.assignProgramManager('user-1', MIA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects assigning a System Admin as Program Manager', async () => {
    const { service } = makeService({
      user: makeUser({ role: UserRole.ADMIN }),
      program: { id: P_A } as AcademicProgram,
    });
    await expect(service.assignProgramManager('user-1', P_A)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('removing the program manager reverts to STUDENT and keeps the program', async () => {
    const { service } = makeService({ user: makeUser({ role: UserRole.PROGRAM_MANAGER, programId: P_A }) });
    const result = await service.removeProgramManager('user-1');
    expect(result.role).toBe(UserRole.STUDENT);
    expect(result.programId).toBe(P_A);
    expect(result.managedProgramId).toBeNull();
  });
});

describe('UsersService academic assignments (Subject Manager)', () => {
  const userInP_A = () => makeUser({ programId: P_A });

  it('accepts subjects inside the user program and exposes the scope', async () => {
    const { service } = makeService({
      user: userInP_A(),
      subjects: [makeSubject(S_1, P_A), makeSubject(S_2, P_A)],
    });
    const result = await service.setSubjectManagers('user-1', [S_1, S_2]);
    expect(result.role).toBe(UserRole.SUBJECT_MANAGER);
    expect(result.managedSubjectIds).toEqual([S_1, S_2]);
  });

  it('rejects cross-program subjects', async () => {
    const { service } = makeService({
      user: userInP_A(),
      subjects: [makeSubject(S_1, P_B)],
    });
    await expect(service.setSubjectManagers('user-1', [S_1])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects mixed cross-program lists (atomic: nothing written)', async () => {
    const { service, store } = makeService({
      user: userInP_A(),
      subjects: [makeSubject(S_1, P_A), makeSubject(S_2, P_B)],
    });
    await expect(service.setSubjectManagers('user-1', [S_1, S_2])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(store.assignments).toEqual([]);
  });

  it('rejects subjects with a null (ambiguous) program instead of broadening permissions', async () => {
    const { service } = makeService({
      user: userInP_A(),
      subjects: [makeSubject(S_1, null)],
    });
    await expect(service.setSubjectManagers('user-1', [S_1])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects nonexistent subjects', async () => {
    const { service } = makeService({ user: userInP_A(), subjects: [] });
    await expect(service.setSubjectManagers('user-1', [MIA])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects assignments for a user without a program', async () => {
    const { service } = makeService({
      user: makeUser(),
      subjects: [makeSubject(S_1, P_A)],
    });
    await expect(service.setSubjectManagers('user-1', [S_1])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('an empty list clears assignments and reverts to STUDENT', async () => {
    const { service, store } = makeService({
      user: userInP_A(),
      subjects: [makeSubject(S_1, P_A)],
    });
    store.assignments.push({ userId: 'user-1', subjectId: S_1 });
    const result = await service.setSubjectManagers('user-1', []);
    expect(result.role).toBe(UserRole.STUDENT);
    expect(result.managedSubjectIds).toEqual([]);
    expect(store.assignments).toEqual([]);
  });

  it('removing the last subject reverts to STUDENT', async () => {
    const { service, store } = makeService({
      user: makeUser({ role: UserRole.SUBJECT_MANAGER, programId: P_A }),
    });
    store.assignments.push({ userId: 'user-1', subjectId: S_1 });
    const result = await service.removeSubjectManager('user-1', S_1);
    expect(result.role).toBe(UserRole.STUDENT);
    expect(result.managedSubjectIds).toEqual([]);
    expect(store.assignments).toEqual([]);
  });

  it('inspect returns role, program, managed program and managed subjects', async () => {
    const { service } = makeService({
      user: makeUser({ role: UserRole.SUBJECT_MANAGER, programId: P_A }),
      subjects: [makeSubject(S_1, P_A)],
    });
    await service.setSubjectManagers('user-1', [S_1]);
    const result = await service.getAcademicAssignments('user-1');
    expect(result.role).toBe(UserRole.SUBJECT_MANAGER);
    expect(result.managedProgramId).toBeNull();
    expect(result.managedSubjectIds).toEqual([S_1]);
  });

  it('inspect never reveals managed subjects for non-subject-managers', async () => {
    const { service } = makeService({ user: makeUser({ role: UserRole.ADMIN }) });
    const result = await service.getAcademicAssignments('user-1');
    expect(result.managedSubjectIds).toEqual([]);
    expect(result.managedProgramId).toBeNull();
  });
});

describe('UsersService.update role restrictions (PATCH)', () => {
  it('rejects granting PROGRAM_MANAGER through the plain role update', async () => {
    const { service } = makeService();
    await expect(
      service.update('user-1', { role: UserRole.PROGRAM_MANAGER } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects granting SUBJECT_MANAGER through the plain role update', async () => {
    const { service } = makeService();
    await expect(
      service.update('user-1', { role: UserRole.SUBJECT_MANAGER } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to clear the program of a manager account', async () => {
    const { service } = makeService({
      user: makeUser({ role: UserRole.PROGRAM_MANAGER, programId: P_A }),
    });
    await expect(
      service.update('user-1', { programId: null } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});