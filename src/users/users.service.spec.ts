import { NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AccountStatus, UserRole } from '../common/enums.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import type { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

const PROGRAM_ID = '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a';

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

interface ServiceOverrides {
  user?: User;
  program?: AcademicProgram | null;
  subjects?: Subject[];
}

function makeService(overrides: ServiceOverrides = {}) {
  const stored = overrides.user ?? makeUser();
  let saved: User | undefined;
  const users = {
    findOne: async () => stored,
    save: async (user: User) => {
      saved = user;
      return user;
    },
  } as unknown as Repository<User>;
  const refreshTokens = {
    update: async () => ({ affected: 1, raw: {}, generatedMaps: [] }),
  } as unknown as Repository<RefreshToken>;
  const programs = {
    findOne: async () => overrides.program ?? null,
  } as unknown as Repository<AcademicProgram>;
  const subjects = {
    find: async () => overrides.subjects ?? [],
  } as unknown as Repository<Subject>;
  const assignments = {
    find: async () => [],
    delete: async () => ({ affected: 0, raw: {}, generatedMaps: [] }),
    count: async () => 0,
  } as unknown as Repository<SubjectManagerAssignment>;
  const dataSource = {
    transaction: async <T>(run: (manager: unknown) => Promise<T>): Promise<T> => {
      const manager = {
        delete: assignments.delete,
        save: async (entity: unknown) => entity,
        create: async (_target: unknown, attrs: unknown) => attrs,
        count: assignments.count,
      };
      return run(manager);
    },
  } as unknown as DataSource;
  const service = new UsersService(users, refreshTokens, programs, subjects, assignments, dataSource);
  return { service, getSaved: () => saved };
}

describe('UsersService.update (admin)', () => {
  it('assigns a program to a user when the program exists', async () => {
    const { service, getSaved } = makeService({
      program: { id: PROGRAM_ID, name: 'CS', isActive: true } as AcademicProgram,
    });
    const result = await service.update('user-1', { programId: PROGRAM_ID } as UpdateUserDto);
    expect(result.programId).toBe(PROGRAM_ID);
    expect(getSaved()?.programId).toBe(PROGRAM_ID);
  });

  it('clears the program when programId is null', async () => {
    const { service, getSaved } = makeService({ user: makeUser({ programId: PROGRAM_ID }) });
    const result = await service.update('user-1', { programId: null } as UpdateUserDto);
    expect(result.programId).toBeNull();
    expect(getSaved()?.programId).toBeNull();
  });

  it('rejects assigning an unknown program', async () => {
    const { service } = makeService({ program: null });
    await expect(
      service.update('user-1', { programId: PROGRAM_ID } as UpdateUserDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.updateMe (self)', () => {
  it('never lets a regular user change their own program through the profile endpoint', async () => {
    const { service } = makeService({ user: makeUser({ programId: PROGRAM_ID }) });
    const dto = { fullName: 'New Name', programId: 'another-program' } as unknown as UpdateProfileDto;
    const result = await service.updateMe('user-1', dto);
    expect(result.fullName).toBe('New Name');
    expect(result.programId).toBe(PROGRAM_ID);
  });

  it('exposes programId on the public profile', async () => {
    const { service } = makeService({ user: makeUser({ programId: PROGRAM_ID }) });
    const result = await service.findMe('user-1');
    expect(result.programId).toBe(PROGRAM_ID);
  });
});