import { AcademicProgram } from '../programs/entities/program.entity.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { AcademicEvent } from '../events/entities/academic-event.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { SectionSchedule } from '../sections/entities/section-schedule.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { StudentEnrollment } from '../enrollments/entities/enrollment.entity.js';
import { StudyTeam } from '../teams/entities/study-team.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { Task } from '../tasks/entities/task.entity.js';
import { TeamJoinRequest } from '../teams/entities/team-join-request.entity.js';
import { TeamMembership } from '../teams/entities/team-membership.entity.js';
import { TeamTaskSlot } from '../teams/entities/team-task-slot.entity.js';
import { SubjectManagerAssignment } from '../users/entities/subject-manager-assignment.entity.js';
import { User } from '../users/entities/user.entity.js';

/**
 * Explicit entity list shared by the Nest TypeORM module and the TypeORM CLI
 * data source. Keeping this explicit (instead of globs) avoids path/extension
 * issues in this ESM project.
 */
export const ENTITIES = [
  User,
  RefreshToken,
  PasswordResetToken,
  AcademicProgram,
  Semester,
  Subject,
  Professor,
  AcademicSection,
  SectionSchedule,
  StudentEnrollment,
  StudyTeam,
  TeamMembership,
  TeamJoinRequest,
  TeamTaskSlot,
  Task,
  AcademicEvent,
  Notification,
  SubjectManagerAssignment,
];
