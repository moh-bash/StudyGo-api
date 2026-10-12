import { UserRole, isManagerRole } from '../common/enums.js';

/** Minimal shapes needed to evaluate academic management scope. */
export interface ScopeUser {
  role: UserRole;
  programId: string | null;
}

export interface ScopeSubject {
  id: string;
  programId: string | null;
}

/**
 * The authoritative authorization scope for one request, resolved fresh from the
 * database by `AcademicScopeService`. Never trust a client-supplied role, program
 * or subject id: this object is the server-side source of truth.
 */
export interface ResolvedScope {
  userId: string;
  role: UserRole;
  programId: string | null;
  /** Explicitly assigned subject ids — populated for SUBJECT_MANAGER only. */
  assignedSubjectIds: string[];
}

/**
 * For a Program Manager, the managed program is exactly the user's own academic
 * program (`User.programId`). No other program can ever be managed: the scope is
 * the assignment. Returns `null` for every non-program-manager role.
 */
export function managedProgramId(user: ScopeUser): string | null {
  return user.role === UserRole.PROGRAM_MANAGER ? user.programId : null;
}

/**
 * True only when `user` is a Program Manager whose own program is `programId`.
 * There is deliberately no way to express "manages a different program".
 */
export function canManageProgram(user: ScopeUser, programId: string): boolean {
  return user.role === UserRole.PROGRAM_MANAGER && user.programId === programId;
}

/**
 * A subject is inside a program when it has a resolved program and it matches.
 * A subject with a null (ambiguous/unresolved) program is never inside a program
 * — permissions are never silently broadened for unprogrammed subjects.
 */
export function isSubjectWithinProgram(subject: ScopeSubject, programId: string): boolean {
  return subject.programId !== null && subject.programId === programId;
}

/**
 * True only when `user` is a Subject Manager, the subject is within the user's
 * own program, and the subject is one of the user's explicit assignments.
 */
export function canManageSubject(
  user: ScopeUser,
  subject: ScopeSubject,
  assignedSubjectIds: readonly string[],
): boolean {
  if (user.role !== UserRole.SUBJECT_MANAGER || user.programId === null) {
    return false;
  }
  return (
    isSubjectWithinProgram(subject, user.programId) && assignedSubjectIds.includes(subject.id)
  );
}

/**
 * Manager roles require an academic program to be meaningful. Guards against
 * ever persisting a manager assignment without a program.
 */
export function managerRoleRequiresProgram(user: ScopeUser): boolean {
  return isManagerRole(user.role) && user.programId === null;
}

// --- Manager capability helpers (extend the scope model for subjects/sections) ---

/** True for any academic manager role (Program Manager or Subject Manager). */
export function isManager(user: ScopeUser): boolean {
  return isManagerRole(user.role);
}

/**
 * A manager may create subjects only when they have an assigned academic
 * program (which is mandatory for manager roles). Admins create anywhere.
 */
export function canCreateSubject(user: ScopeUser): boolean {
  return isManager(user) && user.programId !== null;
}

/**
 * Whether the user may read or manage the given subject.
 * - ADMIN: any subject (the trusted control case).
 * - PROGRAM_MANAGER: any subject inside their own program.
 * - SUBJECT_MANAGER: only explicitly assigned subjects (within their program).
 * - STUDENT / anything else: false (students only use the read-only catalog).
 */
export function canAccessSubject(
  user: ScopeUser,
  subject: ScopeSubject,
  assignedSubjectIds: readonly string[],
): boolean {
  if (user.role === UserRole.ADMIN) {
    return true;
  }
  if (user.role === UserRole.PROGRAM_MANAGER) {
    return user.programId !== null && isSubjectWithinProgram(subject, user.programId);
  }
  return canManageSubject(user, subject, assignedSubjectIds);
}

/** Convenience wrapper evaluating a resolved request scope against a subject. */
export function scopeCanAccessSubject(scope: ResolvedScope, subject: ScopeSubject): boolean {
  return canAccessSubject(scope, subject, scope.assignedSubjectIds);
}
