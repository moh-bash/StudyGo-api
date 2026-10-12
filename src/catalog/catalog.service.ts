import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { SectionSchedule } from '../sections/entities/section-schedule.entity.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  CatalogDto,
  CatalogProfessorDto,
  CatalogProgramDto,
  CatalogScheduleDto,
  CatalogSectionDto,
  CatalogSemesterDto,
  CatalogSubjectDto,
} from './dto/catalog.dto.js';

const EMPTY_CATALOG: CatalogDto = {
  program: null,
  semesters: [],
  subjects: [],
  professors: [],
  sections: [],
  schedules: [],
};

/**
 * Program-scoped academic catalog reader.
 *
 * Scope is the authenticated caller's own `User.programId` — there is no
 * program parameter, so a caller can never request another program's catalog.
 * This is deliberately narrower than the existing open academic read endpoints
 * (which any authenticated user may use for any program), so it grants no new
 * access to any role; it only makes the caller's own catalog retrievable in a
 * single, relationship-complete, stable-id payload suitable for offline sync.
 *
 * Scope rules (resolving the documented subject↔section program asymmetry):
 * - a subject belongs to the program when `subject.programId === programId`;
 * - a semester belongs to the program when `semester.programId === programId`;
 * - a section is in scope only when BOTH its subject and its semester belong to
 *   the program, so cross-program offerings are never returned;
 * - inactive subjects and sections are excluded (same rule as the public
 *   registration catalog), and an empty catalog is a valid response.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(Semester) private readonly semesters: Repository<Semester>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(Professor) private readonly professors: Repository<Professor>,
    @InjectRepository(SectionSchedule) private readonly schedules: Repository<SectionSchedule>,
  ) {}

  async getCatalogForUser(user: AuthenticatedUser): Promise<CatalogDto> {
    // The access token carries only id/email/role, so resolve the program here.
    const owner = await this.users.findOne({
      where: { id: user.id },
      relations: { program: true },
    });
    const program = owner?.program ?? null;
    if (!program) {
      return { ...EMPTY_CATALOG };
    }
    return this.buildCatalog(program);
  }

  private async buildCatalog(program: AcademicProgram): Promise<CatalogDto> {
    const programId = program.id;

    // Active subjects of the program, with their prerequisite ids. `relations`
    // batches the many-to-many load (no per-row N+1).
    const subjects = await this.subjects.find({
      where: { programId, isActive: true },
      relations: { prerequisites: true },
      order: { code: 'ASC' },
    });
    const subjectIds = subjects.map((subject) => subject.id);

    const semesters = await this.semesters.find({
      where: { programId },
      order: { startDate: 'DESC' },
    });
    const semesterIds = semesters.map((semester) => semester.id);

    // A section is in scope only when both endpoints (subject and semester) are
    // themselves in the program — this is the intersection that resolves the
    // subject.programId / semester.programId asymmetry without guessing.
    const sections =
      subjectIds.length > 0 && semesterIds.length > 0
        ? await this.sections.find({
            where: {
              subjectId: In(subjectIds),
              semesterId: In(semesterIds),
              isActive: true,
            },
            order: { code: 'ASC' },
          })
        : [];

    const professorIds = [
      ...new Set(
        sections
          .map((section) => section.professorId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const professors =
      professorIds.length > 0
        ? await this.professors.find({ where: { id: In(professorIds) }, order: { name: 'ASC' } })
        : [];

    const sectionIds = sections.map((section) => section.id);
    const schedules =
      sectionIds.length > 0
        ? await this.schedules.find({
            where: { sectionId: In(sectionIds) },
            order: { dayOfWeek: 'ASC', startTime: 'ASC' },
          })
        : [];

    return {
      program: toProgramDto(program),
      semesters: semesters.map(toSemesterDto),
      subjects: subjects.map(toSubjectDto),
      professors: professors.map(toProfessorDto),
      sections: sections.map(toSectionDto),
      schedules: schedules.map(toScheduleDto),
    };
  }
}

function toProgramDto(program: AcademicProgram): CatalogProgramDto {
  return { id: program.id, name: program.name, code: program.code };
}

function toSemesterDto(semester: Semester): CatalogSemesterDto {
  return {
    id: semester.id,
    programId: semester.programId,
    name: semester.name,
    code: semester.code,
    startDate: semester.startDate,
    endDate: semester.endDate,
    status: semester.status,
  };
}

function toSubjectDto(subject: Subject): CatalogSubjectDto {
  return {
    id: subject.id,
    programId: subject.programId as string,
    code: subject.code,
    nameEn: subject.nameEn,
    nameAr: subject.nameAr,
    creditHours: subject.creditHours,
    projectWeight: subject.projectWeight,
    examWeight: subject.examWeight,
    prerequisiteIds: (subject.prerequisites ?? []).map((prerequisite) => prerequisite.id),
  };
}

function toProfessorDto(professor: Professor): CatalogProfessorDto {
  return {
    id: professor.id,
    name: professor.name,
    email: professor.email,
    profileImageUrl: professor.profileImageUrl,
    description: professor.description,
  };
}

function toSectionDto(section: AcademicSection): CatalogSectionDto {
  return {
    id: section.id,
    semesterId: section.semesterId,
    subjectId: section.subjectId,
    professorId: section.professorId,
    code: section.code,
    location: section.location,
    deliveryMode: section.deliveryMode,
    capacity: section.capacity,
  };
}

function toScheduleDto(schedule: SectionSchedule): CatalogScheduleDto {
  return {
    id: schedule.id,
    sectionId: schedule.sectionId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    room: schedule.room,
  };
}
