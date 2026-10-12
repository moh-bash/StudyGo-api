import { BadRequestException, ConflictException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from './mail/mail.service.js';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { AccountStatus, UserRole } from '../common/enums.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import type { User } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/register.dto.js';

const PROGRAM_ID = '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a';

function makeProgram(overrides: Partial<AcademicProgram> = {}): AcademicProgram {
  return {
    id: PROGRAM_ID,
    name: 'Computer Science',
    code: 'CS',
    description: null,
    isActive: true,
    ...overrides,
  } as AcademicProgram;
}

interface ServiceOverrides {
  existing?: User | null;
  program?: AcademicProgram | null;
}

function makeService(overrides: ServiceOverrides = {}) {
  const created: User[] = [];
  const users = {
    findOne: async () => overrides.existing ?? null,
    create: (data: Record<string, unknown>) => ({ ...data }) as unknown as User,
    save: async (user: User) => {
      created.push(user);
      return user;
    },
  } as unknown as Repository<User>;
  const refreshTokens = {
    create: (data: Record<string, unknown>) => data,
    save: async (record: Record<string, unknown>) => record,
  } as unknown as Repository<RefreshToken>;
  const resetTokens = {
    create: (data: Record<string, unknown>) => data,
    save: async (record: Record<string, unknown>) => record,
  } as unknown as Repository<PasswordResetToken>;
  const programs = {
    findOne: async () => overrides.program ?? null,
  } as unknown as Repository<AcademicProgram>;
  const jwt = { signAsync: async () => 'signed-access-token' } as unknown as JwtService;
  const config = {
    get: (key: string) => (key === 'jwt.refreshExpiresIn' ? '7d' : undefined),
  } as unknown as ConfigService;
  const mail = {} as MailService;
  const service = new AuthService(
    users,
    refreshTokens,
    resetTokens,
    programs,
    jwt,
    config,
    mail,
  );
  return { service, created };
}

function registerDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    fullName: 'Layla Haddad',
    email: 'layla@example.com',
    password: 'Str0ngPass',
    ...overrides,
  } as RegisterDto;
}

describe('AuthService.register', () => {
  it('creates a student and associates the validated program', async () => {
    const { service, created } = makeService({ program: makeProgram() });
    const result = await service.register(registerDto({ programId: PROGRAM_ID }));

    expect(created).toHaveLength(1);
    expect(created[0].programId).toBe(PROGRAM_ID);
    expect(created[0].role).toBe(UserRole.STUDENT);
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.user.programId).toBe(PROGRAM_ID);
  });

  it('creates a student without a program when none is supplied', async () => {
    const { service, created } = makeService();
    const result = await service.register(registerDto());

    expect(created[0].programId).toBeNull();
    expect(result.user.studentUniversityId).toBeNull();
  });

  it('rejects registration with a nonexistent program', async () => {
    const { service } = makeService({ program: null });
    await expect(service.register(registerDto({ programId: PROGRAM_ID }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects registration with an inactive program', async () => {
    const { service } = makeService({ program: makeProgram({ isActive: false }) });
    await expect(service.register(registerDto({ programId: PROGRAM_ID }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not leave a partially created user when the program is invalid', async () => {
    const { service, created } = makeService({ program: null });
    await expect(
      service.register(registerDto({ programId: PROGRAM_ID })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(created).toHaveLength(0);
  });

  it('rejects a duplicate email', async () => {
    const existing = {
      id: 'existing-user',
      email: 'layla@example.com',
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
    } as User;
    const { service } = makeService({ existing });
    await expect(service.register(registerDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores an attacker-supplied role and always creates STUDENT', async () => {
    const dto = registerDto({ programId: PROGRAM_ID }) as RegisterDto & { role: string };
    dto.role = 'ADMIN';
    const { service, created } = makeService({ program: makeProgram() });
    await service.register(dto);
    expect(created[0].role).toBe(UserRole.STUDENT);
  });

  it('cannot escalate to any management role through registration', async () => {
    for (const attackerRole of [
      'ADMIN',
      'PROGRAM_MANAGER',
      'SUBJECT_MANAGER',
      'MANAGER',
    ]) {
      const dto = registerDto() as RegisterDto & { role: string };
      dto.role = attackerRole;
      const { service, created } = makeService({ program: makeProgram() });
      await service.register(dto);
      expect(created[0].role, attackerRole).toBe(UserRole.STUDENT);
    }
  });

  it('normalizes the email to lowercase before saving', async () => {
    const { service, created } = makeService();
    await service.register(registerDto({ email: 'Layla@Example.COM' }));
    expect(created[0].email).toBe('layla@example.com');
  });
});