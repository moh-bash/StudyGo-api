import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { UserRole } from '../common/enums.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { isManager, scopeCanAccessSubject, type ResolvedScope } from '../users/academic-scope.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { CreateSectionScheduleDto } from './dto/create-section-schedule.dto.js';
import { QuerySectionsDto } from './dto/query-sections.dto.js';
import { UpdateSectionScheduleDto } from './dto/update-section-schedule.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { AcademicSection } from './entities/section.entity.js';
import { SectionSchedule } from './entities/section-schedule.entity.js';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(SectionSchedule) private readonly schedules: Repository<SectionSchedule>,
    @InjectRepository(Semester) private readonly semesters: Repository<Semester>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(Professor) private readonly professors: Repository<Professor>,
  ) {}

  async create(dto: CreateSectionDto, scope: ResolvedScope): Promise<AcademicSection> {
    if (scope.role === UserRole.STUDENT) {
      // Defense-in-depth: the controller already restricts creation to admin and
      // manager roles; the service refuses students outright as well.
      throw new ForbiddenException('Students cannot create sections');
    }
    if (!dto.professorId) {
      // Every class has exactly one primary professor. Enforced here (not only
      // in the DTO) so no internal caller can create a professor-less section.
      throw new BadRequestException('A section requires a primary professor');
    }
    const semester = await this.loadSemester(dto.semesterId);
    const subject = await this.assertSubjectAccess(dto.subjectId, scope);
    this.assertProgramMatch(subject, semester);
    await this.ensureProfessor(dto.professorId);
    const section = this.sections.create({
      semesterId: dto.semesterId,
      subjectId: dto.subjectId,
      professorId: dto.professorId,
      code: dto.code.trim(),
      location: dto.location ?? null,
      deliveryMode: dto.deliveryMode ?? null,
      capacity: dto.capacity ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.save(section);
  }

  async findAll(
    query: QuerySectionsDto,
    scope: ResolvedScope,
  ): Promise<PaginatedResult<AcademicSection>> {
    const qb = this.sections
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.subject', 'subject')
      .leftJoinAndSelect('section.semester', 'semester')
      .leftJoinAndSelect('section.professor', 'professor')
      .orderBy('section.code', 'ASC');
    this.applyScopeFilter(qb, scope);
    if (query.semesterId) {
      qb.andWhere('section.semesterId = :semesterId', { semesterId: query.semesterId });
    }
    if (query.subjectId) {
      qb.andWhere('section.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.professorId) {
      qb.andWhere('section.professorId = :professorId', { professorId: query.professorId });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('section.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere('section.code ILIKE :search', { search: `%${query.search}%` });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(
    id: string,
    scope: ResolvedScope,
  ): Promise<AcademicSection & { schedules: SectionSchedule[] }> {
    const section = await this.sections.findOne({
      where: { id },
      relations: { subject: true, semester: true, professor: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (!this.canReadSection(section, scope)) {
      throw new NotFoundException('Section not found');
    }
    const schedules = await this.schedules.find({
      where: { sectionId: id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return Object.assign(section, { schedules });
  }

  async update(id: string, dto: UpdateSectionDto, scope: ResolvedScope): Promise<AcademicSection> {
    const section = await this.getOrFail(id);
    await this.assertSubjectAccess(section.subjectId, scope);
    if (dto.semesterId !== undefined) {
      await this.loadSemester(dto.semesterId);
      section.semesterId = dto.semesterId;
    }
    if (dto.subjectId !== undefined) {
      await this.assertSubjectAccess(dto.subjectId, scope);
      section.subjectId = dto.subjectId;
    }
    if (dto.semesterId !== undefined || dto.subjectId !== undefined) {
      // Re-validate the final subject/semester pairing so no update can move a
      // section into a subject-offering that spans two different programs.
      const semester = await this.loadSemester(section.semesterId);
      const subject = await this.subjects.findOne({ where: { id: section.subjectId } });
      if (!subject) {
        throw new NotFoundException('Section not found');
      }
      this.assertProgramMatch(subject, semester);
    }
    if (dto.professorId !== undefined) {
      if (dto.professorId) {
        await this.ensureProfessor(dto.professorId);
      }
      section.professorId = dto.professorId ?? null;
    }
    if (dto.code !== undefined) {
      section.code = dto.code.trim();
    }
    if (dto.location !== undefined) {
      section.location = dto.location;
    }
    if (dto.deliveryMode !== undefined) {
      section.deliveryMode = dto.deliveryMode;
    }
    if (dto.capacity !== undefined) {
      section.capacity = dto.capacity;
    }
    if (dto.isActive !== undefined) {
      section.isActive = dto.isActive;
    }
    return this.save(section);
  }

  async remove(id: string, scope: ResolvedScope): Promise<void> {
    const section = await this.getOrFail(id);
    await this.assertSubjectAccess(section.subjectId, scope);
    try {
      await this.sections.remove(section);
    } catch {
      throw new BadRequestException(
        'Section cannot be deleted while enrollments reference it; deactivate it instead',
      );
    }
  }

  async listSchedules(sectionId: string, scope: ResolvedScope): Promise<SectionSchedule[]> {
    await this.assertSectionAccess(sectionId, scope);
    return this.schedules.find({
      where: { sectionId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async addSchedule(
    sectionId: string,
    dto: CreateSectionScheduleDto,
    scope: ResolvedScope,
  ): Promise<SectionSchedule> {
    await this.assertSectionAccess(sectionId, scope);
    this.assertTimeRange(dto.startTime, dto.endTime);
    return this.schedules.save(
      this.schedules.create({
        sectionId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room ?? null,
      }),
    );
  }

  async updateSchedule(
    sectionId: string,
    scheduleId: string,
    dto: UpdateSectionScheduleDto,
    scope: ResolvedScope,
  ): Promise<SectionSchedule> {
    await this.assertSectionAccess(sectionId, scope);
    const schedule = await this.getScheduleOrFail(sectionId, scheduleId);
    const start = dto.startTime ?? schedule.startTime;
    const end = dto.endTime ?? schedule.endTime;
    this.assertTimeRange(start, end);
    schedule.dayOfWeek = dto.dayOfWeek ?? schedule.dayOfWeek;
    schedule.startTime = start;
    schedule.endTime = end;
    if (dto.room !== undefined) {
      schedule.room = dto.room;
    }
    return this.schedules.save(schedule);
  }

  async removeSchedule(sectionId: string, scheduleId: string, scope: ResolvedScope): Promise<void> {
    await this.assertSectionAccess(sectionId, scope);
    const schedule = await this.getScheduleOrFail(sectionId, scheduleId);
    await this.schedules.remove(schedule);
  }

  private async getOrFail(id: string): Promise<AcademicSection> {
    const section = await this.sections.findOne({ where: { id } });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return section;
  }

  private async getScheduleOrFail(sectionId: string, scheduleId: string): Promise<SectionSchedule> {
    const schedule = await this.schedules.findOne({ where: { id: scheduleId, sectionId } });
    if (!schedule) {
      throw new NotFoundException('Section schedule not found');
    }
    return schedule;
  }

  /**
   * Loads the section and enforces the caller's scope through its subject. Used
   * by every section and schedule mutation so no path bypasses the subject check.
   */
  private async assertSectionAccess(sectionId: string, scope: ResolvedScope): Promise<void> {
    const section = await this.getOrFail(sectionId);
    await this.assertSubjectAccess(section.subjectId, scope);
  }

  /**
   * Enforces the caller's scope against a subject id. Managers only reach their
   * assigned program/subjects; students only reach subjects of their own
   * program; out-of-scope ids surface as 404 so a caller cannot probe for
   * sections of subjects they may not access. Returns the loaded subject so
   * callers can validate academic relationships (e.g. program match).
   */
  private async assertSubjectAccess(subjectId: string, scope: ResolvedScope): Promise<Subject> {
    const subject = await this.subjects.findOne({ where: { id: subjectId } });
    if (scope.role === UserRole.ADMIN) {
      if (!subject) {
        throw new BadRequestException('Subject not found');
      }
      return subject;
    }
    if (isManager(scope)) {
      // Unknown and out-of-scope subjects both surface as 404 for managers so a
      // subject they do not manage cannot be probed for existence.
      if (!subject || !scopeCanAccessSubject(scope, subject)) {
        throw new NotFoundException('Section not found');
      }
      return subject;
    }
    // Students: only subjects of their own academic program are reachable.
    if (!subject || scope.programId === null || subject.programId !== scope.programId) {
      throw new NotFoundException('Section not found');
    }
    return subject;
  }

  /** Read boundary for one loaded section, derived through its subject. */
  private canReadSection(
    section: AcademicSection & { subject?: Subject | null },
    scope: ResolvedScope,
  ): boolean {
    if (scope.role === UserRole.ADMIN) {
      return true;
    }
    if (!section.subject) {
      return false;
    }
    if (isManager(scope)) {
      return scopeCanAccessSubject(scope, section.subject);
    }
    // Students may only read sections whose subject belongs to their program.
    return scope.programId !== null && section.subject.programId === scope.programId;
  }

  /**
   * A class is a subject offering inside one semester; the subject and the
   * semester must belong to the same specialization, otherwise the section
   * would belong to no coherent catalog.
   */
  private assertProgramMatch(subject: Subject, semester: Semester): void {
    if (subject.programId === null) {
      throw new BadRequestException('The subject does not belong to an academic program');
    }
    if (subject.programId !== semester.programId) {
      throw new BadRequestException('The subject and the semester belong to different academic programs');
    }
  }

  private applyScopeFilter(
    qb: ReturnType<Repository<AcademicSection>['createQueryBuilder']>,
    scope: ResolvedScope,
  ): void {
    // Admins read the whole catalog: no scoping filter at all.
    if (scope.role === UserRole.ADMIN) {
      return;
    }
    if (scope.role === UserRole.SUBJECT_MANAGER) {
      if (scope.assignedSubjectIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
      }
      qb.andWhere('section.subjectId IN (:...scopeSubjectIds)', {
        scopeSubjectIds: scope.assignedSubjectIds,
      });
      return;
    }
    if (scope.role === UserRole.PROGRAM_MANAGER) {
      if (scope.programId === null) {
        qb.andWhere('1 = 0');
        return;
      }
      qb.andWhere('subject.programId = :scopeProgramId', { scopeProgramId: scope.programId });
      return;
    }
    // Students: the read scope is exactly their own academic program. A student
    // with no program sees an empty list — never other programs' sections.
    if (scope.programId === null) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('subject.programId = :scopeProgramId', { scopeProgramId: scope.programId });
  }

  private assertTimeRange(start: string, end: string): void {
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }

  private async loadSemester(id: string): Promise<Semester> {
    const semester = await this.semesters.findOne({ where: { id } });
    if (!semester) {
      throw new BadRequestException('Semester not found');
    }
    return semester;
  }

  private async ensureProfessor(id: string): Promise<void> {
    if (!(await this.professors.exists({ where: { id } }))) {
      throw new BadRequestException('Professor not found');
    }
  }

  private async save(section: AcademicSection): Promise<AcademicSection> {
    try {
      return await this.sections.save(section);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('A section with this code already exists in the semester');
      }
      throw error;
    }
  }
}
