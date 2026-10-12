import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../enums.js';
import { RolesGuard } from './roles.guard.js';

function makeContext(userRole?: UserRole): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { id: 'u1', email: 'u@x.co', role: userRole } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: UserRole[] | undefined) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    expect(makeGuard(undefined).canActivate(makeContext(UserRole.STUDENT))).toBe(true);
  });

  it('allows the matching role', () => {
    expect(makeGuard([UserRole.ADMIN]).canActivate(makeContext(UserRole.ADMIN))).toBe(true);
  });

  it('denies a non-matching role', () => {
    expect(makeGuard([UserRole.ADMIN]).canActivate(makeContext(UserRole.STUDENT))).toBe(false);
    expect(makeGuard([UserRole.PROGRAM_MANAGER]).canActivate(makeContext(UserRole.SUBJECT_MANAGER))).toBe(false);
  });

  it('denies when there is no authenticated user', () => {
    expect(makeGuard([UserRole.ADMIN]).canActivate(makeContext())).toBe(false);
  });
});