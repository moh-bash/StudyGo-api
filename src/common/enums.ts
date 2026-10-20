/**
 * Central enum definitions shared across modules.
 *
 * Storing these as strings (rather than integers) keeps the database readable
 * and makes it safe to append new members later without renumbering.
 */

export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
  /** Manages exactly one academic program: the user's own `programId`. */
  PROGRAM_MANAGER = 'PROGRAM_MANAGER',
  /** Manages one or more subjects, each within the user's own `programId`. */
  SUBJECT_MANAGER = 'SUBJECT_MANAGER',
}

/**
 * Roles that carry an academic management scope and therefore require the user
 * to have a non-null `programId`.
 */
export const MANAGER_ROLES: readonly UserRole[] = [UserRole.PROGRAM_MANAGER, UserRole.SUBJECT_MANAGER];

export function isManagerRole(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum SemesterStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum EnrollmentStatus {
  ENROLLED = 'ENROLLED',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
  FAILED = 'FAILED',
}

export enum TeamRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum TeamStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DISBANDED = 'DISBANDED',
}

export enum TeamVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum JoinRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Eligibility scope of a Phase 5 subject team.
 *
 * - `SECTION`   — only students whose section is the team's originating section.
 * - `PROFESSOR` — any section of the same subject taught by the same professor.
 */
export enum TeamScope {
  SECTION = 'SECTION',
  PROFESSOR = 'PROFESSOR',
}

/**
 * How a team can be contacted outside the app. Exactly the three methods the
 * Phase 5 specification allows — no plain-phone or WhatsApp-username variant.
 */
export enum TeamContactMethod {
  WHATSAPP_PHONE = 'WHATSAPP_PHONE',
  TELEGRAM = 'TELEGRAM',
  GROUP_LINK = 'GROUP_LINK',
}

/** State of one task slot on a subject team. */
export enum TeamTaskSlotState {
  OPEN = 'OPEN',
  JOINED = 'JOINED',
}

export enum TaskType {
  ASSIGNMENT = 'ASSIGNMENT',
  PROJECT = 'PROJECT',
  EXAM = 'EXAM',
  LECTURE = 'LECTURE',
  PERSONAL = 'PERSONAL',
  OTHER = 'OTHER',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum AcademicEventType {
  LECTURE = 'LECTURE',
  EXAM = 'EXAM',
  ASSIGNMENT = 'ASSIGNMENT',
  PROJECT = 'PROJECT',
  HOLIDAY = 'HOLIDAY',
  OTHER = 'OTHER',
}

export enum NotificationType {
  SYSTEM = 'SYSTEM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  TEAM = 'TEAM',
  ENROLLMENT = 'ENROLLMENT',
  GRADE = 'GRADE',
  REMINDER = 'REMINDER',
}

export enum Weekday {
  SUNDAY = 'SUNDAY',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

export enum DeliveryMode {
  ONLINE = 'ONLINE',
  ON_CAMPUS = 'ON_CAMPUS',
  HYBRID = 'HYBRID',
}
