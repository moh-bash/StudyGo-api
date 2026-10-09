/**
 * Central enum definitions shared across modules.
 *
 * Storing these as strings (rather than integers) keeps the database readable
 * and makes it safe to append new members later without renumbering.
 */

export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
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
