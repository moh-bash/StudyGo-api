import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AccountStatus, UserRole } from '../common/enums.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
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
  /** What the email lookup returns in `create()` (defaults to "not found"). */
  existing?: User | null;
  program?: AcademicProgram | null;
  subjects?: Subject[];
}

function makeService(overrides: ServiceOverrides = {}) {
  const stored = overrides.user ?? makeUser();
  let saved: User | undefined;
  const users = {
    findOne: async () => ('existing' in overrides ? overrides.existing : stored),
    create: (data: Record<string, unknown>) => ({ ...data }) as unknown as User,
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

describe('UsersService.create (admin)', () => {
  function createDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      fullName: 'Layla Haddad',
      email: 'Layla@Example.COM',
      password: 'Str0ngPass',
      ...overrides,
    } as CreateUserDto;
  }

  it('creates an ACTIVE student by default and associates the program', async () => {
    const { service, getSaved } = makeService({
      existing: null,
      program: { id: PROGRAM_ID, name: 'CS', isActive: false } as AcademicProgram,
    });
    const result = await service.create(createDto({ programId: PROGRAM_ID }));

    expect(result.role).toBe(UserRole.STUDENT);
    expect(result.status).toBe(AccountStatus.ACTIVE);
    expect(result.programId).toBe(PROGRAM_ID);
    expect(result.email).toBe('layla@example.com'); // normalized
    expect(result).not.toHaveProperty('passwordHash');
    expect(getSaved()?.role).toBe(UserRole.STUDENT);
    expect(getSaved()?.status).toBe(AccountStatus.ACTIVE);
  });

  it('creates an account without a program when none is supplied', async () => {
    const { service, getSaved } = makeService({ existing: null });
    const result = await service.create(createDto());
    expect(result.programId).toBeNull();
    expect(getSaved()?.programId).toBeNull();
  });

  it('rejects a duplicate email with a conflict', async () => {
    const { service } = makeService({ existing: makeUser() });
    await expect(service.create(createDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown program', async () => {
    const { service } = makeService({ existing: null, program: null });
    await expect(service.create(createDto({ programId: PROGRAM_ID }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('never creates manager roles through the ordinary create endpoint', async () => {
    for (const role of [UserRole.PROGRAM_MANAGER, UserRole.SUBJECT_MANAGER]) {
      const { service, getSaved } = makeService({ existing: null });
      await expect(service.create(createDto({ role }))).rejects.toBeInstanceOf(BadRequestException);
      expect(getSaved()).toBeUndefined();
    }
  });

  it('allows the admin role through creation when explicitly requested', async () => {
    const { service } = makeService({ existing: null });
    const result = await service.create(createDto({ role: UserRole.ADMIN }));
    expect(result.role).toBe(UserRole.ADMIN);
  });
});