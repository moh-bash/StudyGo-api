import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { Professor } from '../professors/entities/professor.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
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

  async create(dto: CreateSectionDto): Promise<AcademicSection> {
    await this.ensureSemester(dto.semesterId);
    await this.ensureSubject(dto.subjectId);
    if (dto.professorId) {
      await this.ensureProfessor(dto.professorId);
    }
    const section = this.sections.create({
      semesterId: dto.semesterId,
      subjectId: dto.subjectId,
      professorId: dto.professorId ?? null,
      code: dto.code.trim(),
      location: dto.location ?? null,
      deliveryMode: dto.deliveryMode ?? null,
      capacity: dto.capacity ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.save(section);
  }

  async findAll(query: QuerySectionsDto): Promise<PaginatedResult<AcademicSection>> {
    const qb = this.sections
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.subject', 'subject')
      .leftJoinAndSelect('section.semester', 'semester')
      .leftJoinAndSelect('section.professor', 'professor')
      .orderBy('section.code', 'ASC');
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

  async findOne(id: string): Promise<AcademicSection & { schedules: SectionSchedule[] }> {
    const section = await this.sections.findOne({
      where: { id },
      relations: { subject: true, semester: true, professor: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    const schedules = await this.schedules.find({
      where: { sectionId: id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return Object.assign(section, { schedules });
  }

  async update(id: string, dto: UpdateSectionDto): Promise<AcademicSection> {
    const section = await this.getOrFail(id);
    if (dto.semesterId !== undefined) {
      await this.ensureSemester(dto.semesterId);
      section.semesterId = dto.semesterId;
    }
    if (dto.subjectId !== undefined) {
      await this.ensureSubject(dto.subjectId);
      section.subjectId = dto.subjectId;
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

  async remove(id: string): Promise<void> {
    const section = await this.getOrFail(id);
    try {
      await this.sections.remove(section);
    } catch {
      throw new BadRequestException(
        'Section cannot be deleted while enrollments reference it; deactivate it instead',
      );
    }
  }

  async listSchedules(sectionId: string): Promise<SectionSchedule[]> {
    await this.getOrFail(sectionId);
    return this.schedules.find({
      where: { sectionId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async addSchedule(sectionId: string, dto: CreateSectionScheduleDto): Promise<SectionSchedule> {
    await this.getOrFail(sectionId);
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
  ): Promise<SectionSchedule> {
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

  async removeSchedule(sectionId: string, scheduleId: string): Promise<void> {
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

  private assertTimeRange(start: string, end: string): void {
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }

  private async ensureSemester(id: string): Promise<void> {
    if (!(await this.semesters.exists({ where: { id } }))) {
      throw new BadRequestException('Semester not found');
    }
  }

  private async ensureSubject(id: string): Promise<void> {
    if (!(await this.subjects.exists({ where: { id } }))) {
      throw new BadRequestException('Subject not found');
    }
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
