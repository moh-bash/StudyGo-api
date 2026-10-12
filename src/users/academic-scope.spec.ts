import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import {
  canAccessSubject,
  canCreateSubject,
  canManageProgram,
  canManageSubject,
  isManager,
  isSubjectWithinProgram,
  managedProgramId,
  managerRoleRequiresProgram,
  scopeCanAccessSubject,
} from './academic-scope.js';

describe('academic-scope', () => {
  describe('managedProgramId', () => {
    it('is the user program for a Program Manager', () => {
      expect(managedProgramId({ role: UserRole.PROGRAM_MANAGER, programId: 'P-A' })).toBe('P-A');
    });

    it('is null for every non-program-manager role', () => {
      for (const role of [UserRole.STUDENT, UserRole.ADMIN, UserRole.SUBJECT_MANAGER]) {
        expect(managedProgramId({ role, programId: 'P-A' })).toBeNull();
      }
    });
  });

  describe('canManageProgram', () => {
    it('is true only for the manager program', () => {
      const manager = { role: UserRole.PROGRAM_MANAGER, programId: 'P-A' };
      expect(canManageProgram(manager, 'P-A')).toBe(true);
      expect(canManageProgram(manager, 'P-B')).toBe(false);
    });

    it('is false for a program manager without a program and for other roles', () => {
      expect(canManageProgram({ role: UserRole.PROGRAM_MANAGER, programId: null }, 'P-A')).toBe(false);
      expect(canManageProgram({ role: UserRole.ADMIN, programId: 'P-A' }, 'P-A')).toBe(false);
      expect(canManageProgram({ role: UserRole.STUDENT, programId: 'P-A' }, 'P-A')).toBe(false);
    });
  });

  describe('isSubjectWithinProgram', () => {
    it('rejects unprogrammed (ambiguous) subjects', () => {
      expect(isSubjectWithinProgram({ id: 'S', programId: null }, 'P-A')).toBe(false);
    });

    it('accepts only a matching program', () => {
      expect(isSubjectWithinProgram({ id: 'S', programId: 'P-A' }, 'P-A')).toBe(true);
      expect(isSubjectWithinProgram({ id: 'S', programId: 'P-B' }, 'P-A')).toBe(false);
    });
  });

  describe('canManageSubject', () => {
    it('requires the role, the matching program and an explicit assignment', () => {
      const subject = { id: 'S-1', programId: 'P-A' };
      const user = { role: UserRole.SUBJECT_MANAGER, programId: 'P-A' };
      expect(canManageSubject(user, subject, ['S-1'])).toBe(true);
      expect(canManageSubject(user, subject, ['S-2'])).toBe(false);
      expect(canManageSubject({ ...user, programId: 'P-B' }, subject, ['S-1'])).toBe(false);
      expect(canManageSubject({ ...user, role: UserRole.STUDENT }, subject, ['S-1'])).toBe(false);
    });

    it('never accepts a subject without a program (does not broaden permissions)', () => {
      const subject = { id: 'S-1', programId: null };
      const user = { role: UserRole.SUBJECT_MANAGER, programId: 'P-A' };
      expect(canManageSubject(user, subject, ['S-1'])).toBe(false);
    });
  });

  describe('managerRoleRequiresProgram', () => {
    it('flags manager roles that lack a program', () => {
      expect(managerRoleRequiresProgram({ role: UserRole.PROGRAM_MANAGER, programId: null })).toBe(true);
      expect(managerRoleRequiresProgram({ role: UserRole.SUBJECT_MANAGER, programId: null })).toBe(true);
      expect(managerRoleRequiresProgram({ role: UserRole.PROGRAM_MANAGER, programId: 'P-A' })).toBe(false);
      expect(managerRoleRequiresProgram({ role: UserRole.STUDENT, programId: null })).toBe(false);
    });
  });

  describe('isManager', () => {
    it('is true for both manager roles only', () => {
      expect(isManager({ role: UserRole.PROGRAM_MANAGER, programId: 'P-A' })).toBe(true);
      expect(isManager({ role: UserRole.SUBJECT_MANAGER, programId: 'P-A' })).toBe(true);
      expect(isManager({ role: UserRole.ADMIN, programId: null })).toBe(false);
      expect(isManager({ role: UserRole.STUDENT, programId: null })).toBe(false);
    });
  });

  describe('canCreateSubject', () => {
    it('requires a manager role with a program', () => {
      expect(canCreateSubject({ role: UserRole.PROGRAM_MANAGER, programId: 'P-A' })).toBe(true);
      expect(canCreateSubject({ role: UserRole.SUBJECT_MANAGER, programId: 'P-A' })).toBe(true);
      expect(canCreateSubject({ role: UserRole.SUBJECT_MANAGER, programId: null })).toBe(false);
      expect(canCreateSubject({ role: UserRole.STUDENT, programId: 'P-A' })).toBe(false);
    });
  });

  describe('canAccessSubject', () => {
    const subject = { id: 'S-1', programId: 'P-A' };

    it('lets an admin reach any subject', () => {
      expect(canAccessSubject({ role: UserRole.ADMIN, programId: null }, subject, [])).toBe(true);
    });

    it('lets a program manager reach subjects in their own program only', () => {
      const pm = { role: UserRole.PROGRAM_MANAGER, programId: 'P-A' };
      expect(canAccessSubject(pm, subject, [])).toBe(true);
      expect(canAccessSubject(pm, { id: 'S-2', programId: 'P-B' }, [])).toBe(false);
    });

    it('lets a subject manager reach only explicitly assigned subjects', () => {
      const sm = { role: UserRole.SUBJECT_MANAGER, programId: 'P-A' };
      expect(canAccessSubject(sm, subject, ['S-1'])).toBe(true);
      expect(canAccessSubject(sm, subject, ['S-2'])).toBe(false);
    });

    it('never lets a student or unprogrammed subject pass', () => {
      expect(canAccessSubject({ role: UserRole.STUDENT, programId: 'P-A' }, subject, ['S-1'])).toBe(
        false,
      );
      expect(
        canAccessSubject(
          { role: UserRole.PROGRAM_MANAGER, programId: 'P-A' },
          { id: 'S-3', programId: null },
          [],
        ),
      ).toBe(false);
    });
  });

  describe('scopeCanAccessSubject', () => {
    it('evaluates a resolved scope against a subject', () => {
      const scope = {
        userId: 'u1',
        role: UserRole.SUBJECT_MANAGER,
        programId: 'P-A',
        assignedSubjectIds: ['S-1'],
      };
      expect(scopeCanAccessSubject(scope, { id: 'S-1', programId: 'P-A' })).toBe(true);
      expect(scopeCanAccessSubject(scope, { id: 'S-2', programId: 'P-A' })).toBe(false);
    });
  });
});