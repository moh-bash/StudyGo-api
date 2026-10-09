import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import { TaskStatus, UserRole } from '../common/enums.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { StudyTeam } from '../teams/entities/study-team.entity.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { Task } from './entities/task.entity.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(StudyTeam) private readonly teams: Repository<StudyTeam>,
    @InjectRepository(Semester) private readonly semesters: Repository<Semester>,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateTaskDto): Promise<Task> {
    await this.validateReferences(dto);
    const task = this.tasks.create({
      ownerId: actor.id,
      title: dto.title.trim(),
      description: dto.description ?? null,
      type: dto.type,
      priority: dto.priority,
      status: dto.status ?? TaskStatus.TODO,
      startAt: this.toDate(dto.startAt),
      dueAt: this.toDate(dto.dueAt),
      subjectId: dto.subjectId ?? null,
      sectionId: dto.sectionId ?? null,
      teamId: dto.teamId ?? null,
      semesterId: dto.semesterId ?? null,
    });
    this.applyCompletion(task);
    return this.tasks.save(task);
  }

  async findAll(actor: AuthenticatedUser, query: QueryTasksDto): Promise<PaginatedResult<Task>> {
    const qb = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.subject', 'subject')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('task.team', 'team')
      .leftJoinAndSelect('task.semester', 'semester')
      .orderBy('task.dueAt', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'DESC');

    if (actor.role === UserRole.ADMIN) {
      if (query.ownerId) {
        qb.andWhere('task.ownerId = :ownerId', { ownerId: query.ownerId });
      }
    } else {
      qb.andWhere('task.ownerId = :ownerId', { ownerId: actor.id });
    }
    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('task.type = :type', { type: query.type });
    }
    if (query.priority) {
      qb.andWhere('task.priority = :priority', { priority: query.priority });
    }
    if (query.subjectId) {
      qb.andWhere('task.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.teamId) {
      qb.andWhere('task.teamId = :teamId', { teamId: query.teamId });
    }
    if (query.isCompleted !== undefined) {
      qb.andWhere('task.isCompleted = :isCompleted', { isCompleted: query.isCompleted });
    }
    if (query.dueBefore) {
      qb.andWhere('task.dueAt <= :dueBefore', { dueBefore: new Date(query.dueBefore) });
    }
    if (query.search) {
      qb.andWhere('task.title ILIKE :search', { search: `%${query.search}%` });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Task> {
    const task = await this.getOrFail(id);
    this.assertOwnerOrAdmin(task, actor);
    return task;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.getOrFail(id);
    this.assertOwnerOrAdmin(task, actor);
    await this.validateReferences(dto);
    if (dto.title !== undefined) {
      task.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      task.description = dto.description;
    }
    if (dto.type !== undefined) {
      task.type = dto.type;
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }
    if (dto.startAt !== undefined) {
      task.startAt = this.toDate(dto.startAt);
    }
    if (dto.dueAt !== undefined) {
      task.dueAt = this.toDate(dto.dueAt);
    }
    if (dto.subjectId !== undefined) {
      task.subjectId = dto.subjectId ?? null;
    }
    if (dto.sectionId !== undefined) {
      task.sectionId = dto.sectionId ?? null;
    }
    if (dto.teamId !== undefined) {
      task.teamId = dto.teamId ?? null;
    }
    if (dto.semesterId !== undefined) {
      task.semesterId = dto.semesterId ?? null;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
      this.applyCompletion(task);
    }
    return this.tasks.save(task);
  }

  async complete(actor: AuthenticatedUser, id: string): Promise<Task> {
    const task = await this.getOrFail(id);
    this.assertOwnerOrAdmin(task, actor);
    task.status = TaskStatus.DONE;
    this.applyCompletion(task);
    return this.tasks.save(task);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const task = await this.getOrFail(id);
    this.assertOwnerOrAdmin(task, actor);
    await this.tasks.remove(task);
  }

  private applyCompletion(task: Task): void {
    if (task.status === TaskStatus.DONE) {
      task.isCompleted = true;
      task.completedAt = task.completedAt ?? new Date();
    } else {
      task.isCompleted = false;
      task.completedAt = null;
    }
  }

  private toDate(value: string | undefined): Date | null {
    return value ? new Date(value) : null;
  }

  private async validateReferences(dto: Partial<CreateTaskDto>): Promise<void> {
    if (dto.subjectId && !(await this.subjects.exists({ where: { id: dto.subjectId } }))) {
      throw new BadRequestException('Subject not found');
    }
    if (dto.sectionId && !(await this.sections.exists({ where: { id: dto.sectionId } }))) {
      throw new BadRequestException('Section not found');
    }
    if (dto.teamId && !(await this.teams.exists({ where: { id: dto.teamId } }))) {
      throw new BadRequestException('Team not found');
    }
    if (dto.semesterId && !(await this.semesters.exists({ where: { id: dto.semesterId } }))) {
      throw new BadRequestException('Semester not found');
    }
  }

  private async getOrFail(id: string): Promise<Task> {
    const task = await this.tasks.findOne({
      where: { id },
      relations: { subject: true, section: true, team: true, semester: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private assertOwnerOrAdmin(task: Task, actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN && task.ownerId !== actor.id) {
      throw new ForbiddenException('You can only access your own tasks');
    }
  }
}
