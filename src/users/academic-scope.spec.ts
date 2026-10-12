import { describe, expect, it } from 'vitest';
import { UserRole } from '../common/enums.js';
import {
  canManageProgram,
  canManageSubject,
  isSubjectWithinProgram,
  managedProgramId,
  managerRoleRequiresProgram,
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
});