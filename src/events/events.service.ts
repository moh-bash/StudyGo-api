import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { StudyTeam } from '../teams/entities/study-team.entity.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { QueryEventsDto } from './dto/query-events.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { AcademicEvent } from './entities/academic-event.entity.js';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(AcademicEvent) private readonly events: Repository<AcademicEvent>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(Semester) private readonly semesters: Repository<Semester>,
    @InjectRepository(StudyTeam) private readonly teams: Repository<StudyTeam>,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateEventDto): Promise<AcademicEvent> {
    await this.validateReferences(dto);
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : null;
    this.assertDateRange(startAt, endAt);
    const event = this.events.create({
      title: dto.title.trim(),
      description: dto.description ?? null,
      type: dto.type,
      startAt,
      endAt,
      allDay: dto.allDay ?? false,
      subjectId: dto.subjectId ?? null,
      sectionId: dto.sectionId ?? null,
      semesterId: dto.semesterId ?? null,
      teamId: dto.teamId ?? null,
      createdById: actor.id,
    });
    return this.events.save(event);
  }

  async findAll(query: QueryEventsDto): Promise<PaginatedResult<AcademicEvent>> {
    const qb = this.events
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.subject', 'subject')
      .leftJoinAndSelect('event.section', 'section')
      .leftJoinAndSelect('event.semester', 'semester')
      .leftJoinAndSelect('event.team', 'team')
      .orderBy('event.startAt', 'ASC');
    if (query.type) {
      qb.andWhere('event.type = :type', { type: query.type });
    }
    if (query.subjectId) {
      qb.andWhere('event.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.sectionId) {
      qb.andWhere('event.sectionId = :sectionId', { sectionId: query.sectionId });
    }
    if (query.semesterId) {
      qb.andWhere('event.semesterId = :semesterId', { semesterId: query.semesterId });
    }
    if (query.teamId) {
      qb.andWhere('event.teamId = :teamId', { teamId: query.teamId });
    }
    if (query.from) {
      qb.andWhere('event.startAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('event.startAt <= :to', { to: new Date(query.to) });
    }
    if (query.search) {
      qb.andWhere('event.title ILIKE :search', { search: `%${query.search}%` });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<AcademicEvent> {
    const event = await this.events.findOne({
      where: { id },
      relations: { subject: true, section: true, semester: true, team: true, createdBy: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<AcademicEvent> {
    const event = await this.findOne(id);
    await this.validateReferences(dto);
    if (dto.title !== undefined) {
      event.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      event.description = dto.description;
    }
    if (dto.type !== undefined) {
      event.type = dto.type;
    }
    if (dto.allDay !== undefined) {
      event.allDay = dto.allDay;
    }
    if (dto.subjectId !== undefined) {
      event.subjectId = dto.subjectId ?? null;
    }
    if (dto.sectionId !== undefined) {
      event.sectionId = dto.sectionId ?? null;
    }
    if (dto.semesterId !== undefined) {
      event.semesterId = dto.semesterId ?? null;
    }
    if (dto.teamId !== undefined) {
      event.teamId = dto.teamId ?? null;
    }
    const startAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const endAt = dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : event.endAt;
    this.assertDateRange(startAt, endAt);
    event.startAt = startAt;
    event.endAt = endAt;
    return this.events.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.events.remove(event);
  }

  private assertDateRange(startAt: Date, endAt: Date | null): void {
    if (endAt && endAt < startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }
  }

  private async validateReferences(dto: Partial<CreateEventDto>): Promise<void> {
    if (dto.subjectId && !(await this.subjects.exists({ where: { id: dto.subjectId } }))) {
      throw new BadRequestException('Subject not found');
    }
    if (dto.sectionId && !(await this.sections.exists({ where: { id: dto.sectionId } }))) {
      throw new BadRequestException('Section not found');
    }
    if (dto.semesterId && !(await this.semesters.exists({ where: { id: dto.semesterId } }))) {
      throw new BadRequestException('Semester not found');
    }
    if (dto.teamId && !(await this.teams.exists({ where: { id: dto.teamId } }))) {
      throw new BadRequestException('Team not found');
    }
  }
}
