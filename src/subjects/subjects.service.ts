import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { UserRole } from '../common/enums.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import {
  isManager,
  scopeCanAccessSubject,
  type ResolvedScope,
  type ScopeSubject,
} from '../users/academic-scope.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { QuerySubjectsDto } from './dto/query-subjects.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import { Subject } from './entities/subject.entity.js';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(AcademicProgram) private readonly programs: Repository<AcademicProgram>,
  ) {}

  async create(dto: CreateSubjectDto, scope: ResolvedScope): Promise<Subject> {
    const programId = this.resolveCreateProgram(dto.programId, scope);
    if (programId) {
      await this.ensureProgram(programId);
    }
    const weights = this.resolveWeights(dto.projectWeight, dto.examWeight);
    const subject = this.subjects.create({
      code: dto.code.trim(),
      nameEn: dto.nameEn.trim(),
      nameAr: dto.nameAr.trim(),
      description: dto.description ?? null,
      creditHours: dto.creditHours,
      projectWeight: weights.projectWeight,
      examWeight: weights.examWeight,
      programId,
      isActive: dto.isActive ?? true,
    });
    return this.save(subject);
  }

  async findAll(query: QuerySubjectsDto, scope: ResolvedScope): Promise<PaginatedResult<Subject>> {
    const qb = this.subjects
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.program', 'program')
      .orderBy('subject.code', 'ASC');
    this.applyScopeFilter(qb, scope);
    if (query.programId) {
      qb.andWhere('subject.programId = :programId', { programId: query.programId });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('subject.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere(
        '(subject.code ILIKE :search OR subject.nameEn ILIKE :search OR subject.nameAr ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string, scope: ResolvedScope): Promise<Subject> {
    const subject = await this.getSubjectOrFail(id);
    this.assertSubjectAccess(subject, scope);
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, scope: ResolvedScope): Promise<Subject> {
    const subject = await this.findOne(id, scope);
    if (dto.programId !== undefined) {
      if (isManager(scope)) {
        // A manager can never move a subject out of (or into) another program:
        // the program is the boundary of their authority.
        const target = dto.programId ?? null;
        if (target !== subject.programId) {
          throw new ForbiddenException("Managers cannot change a subject's academic program");
        }
      } else {
        if (dto.programId) {
          await this.ensureProgram(dto.programId);
        }
        subject.programId = dto.programId ?? null;
      }
    }
    if (dto.code !== undefined) {
      subject.code = dto.code.trim();
    }
    if (dto.nameEn !== undefined) {
      subject.nameEn = dto.nameEn.trim();
    }
    if (dto.nameAr !== undefined) {
      subject.nameAr = dto.nameAr.trim();
    }
    if (dto.description !== undefined) {
      subject.description = dto.description;
    }
    if (dto.creditHours !== undefined) {
      subject.creditHours = dto.creditHours;
    }
    if (dto.projectWeight !== undefined || dto.examWeight !== undefined) {
      const weights = this.resolveWeights(
        dto.projectWeight ?? subject.projectWeight,
        dto.examWeight ?? subject.examWeight,
      );
      subject.projectWeight = weights.projectWeight;
      subject.examWeight = weights.examWeight;
    }
    if (dto.isActive !== undefined) {
      subject.isActive = dto.isActive;
    }
    return this.save(subject);
  }

  async remove(id: string): Promise<void> {
    const subject = await this.getSubjectOrFail(id);
    try {
      await this.subjects.remove(subject);
    } catch {
      throw new BadRequestException(
        'Subject cannot be deleted while sections reference it; deactivate it instead',
      );
    }
  }

  async getPrerequisites(id: string, scope: ResolvedScope): Promise<Subject[]> {
    const subject = await this.findOne(id, scope);
    return subject.prerequisites;
  }

  async setPrerequisites(
    id: string,
    prerequisiteIds: string[],
    scope: ResolvedScope,
  ): Promise<Subject[]> {
    const subject = await this.findOne(id, scope);
    const prerequisites = await this.loadPrerequisites(id, prerequisiteIds, scope);
    subject.prerequisites = prerequisites;
    const saved = await this.subjects.save(subject);
    return saved.prerequisites;
  }

  async addPrerequisite(
    id: string,
    prerequisiteId: string,
    scope: ResolvedScope,
  ): Promise<Subject[]> {
    const subject = await this.findOne(id, scope);
    const [found] = await this.loadPrerequisites(id, [prerequisiteId], scope);
    const existing = new Set(subject.prerequisites.map((p) => p.id));
    if (!existing.has(found.id)) {
      subject.prerequisites.push(found);
      await this.subjects.save(subject);
    }
    return this.getPrerequisites(id, scope);
  }

  async removePrerequisite(
    id: string,
    prerequisiteId: string,
    scope: ResolvedScope,
  ): Promise<Subject[]> {
    const subject = await this.findOne(id, scope);
    subject.prerequisites = subject.prerequisites.filter((p) => p.id !== prerequisiteId);
    await this.subjects.save(subject);
    return subject.prerequisites;
  }

  private async getSubjectOrFail(id: string): Promise<Subject> {
    const subject = await this.subjects.findOne({
      where: { id },
      relations: { program: true, prerequisites: true },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  /**
   * Enforce the caller's scope on a subject. Out-of-scope subjects surface as 404
   * (not 403) so a manager cannot probe for the existence of other programs'
   * subjects, and a student cannot read another specialization's subjects. Admins
   * are unaffected.
   */
  private assertSubjectAccess(subject: ScopeSubject, scope: ResolvedScope): void {
    if (scope.role === UserRole.ADMIN) {
      return;
    }
    if (isManager(scope)) {
      if (!scopeCanAccessSubject(scope, subject)) {
        throw new NotFoundException('Subject not found');
      }
      return;
    }
    // Students may only read subjects of their own academic program. A student
    // with no program (or a subject with no program) reaches nothing.
    if (scope.programId === null || subject.programId !== scope.programId) {
      throw new NotFoundException('Subject not found');
    }
  }

  /** A manager may only create inside their own program; the program is forced. */
  private resolveCreateProgram(requested: string | undefined, scope: ResolvedScope): string | null {
    if (!isManager(scope)) {
      return requested ?? null;
    }
    if (scope.programId === null) {
      throw new ForbiddenException('Manager account has no assigned academic program');
    }
    if (requested !== undefined && requested !== scope.programId) {
      throw new ForbiddenException('Managers may only create subjects in their assigned program');
    }
    return scope.programId;
  }

  private applyScopeFilter(
    qb: ReturnType<Repository<Subject>['createQueryBuilder']>,
    scope: ResolvedScope,
  ): void {
    if (scope.role === UserRole.SUBJECT_MANAGER) {
      if (scope.assignedSubjectIds.length === 0) {
        qb.andWhere('1 = 0');
        return;
      }
      qb.andWhere('subject.id IN (:...scopeSubjectIds)', {
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
    // with no program sees an empty catalog — never every program's subjects.
    if (scope.programId === null) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('subject.programId = :scopeProgramId', { scopeProgramId: scope.programId });
  }

  private async loadPrerequisites(
    id: string,
    ids: string[],
    scope: ResolvedScope,
  ): Promise<Subject[]> {
    const unique = [...new Set(ids)];
    if (unique.includes(id)) {
      throw new BadRequestException('A subject cannot be its own prerequisite');
    }
    if (unique.length === 0) {
      return [];
    }
    const found = await this.subjects.find({ where: { id: In(unique) } });
    if (found.length !== unique.length) {
      throw new BadRequestException('One or more prerequisite subjects do not exist');
    }
    if (isManager(scope)) {
      // Prerequisites must themselves be subjects the manager is authorized to
      // manage — otherwise a manager could use the prerequisite graph to reach a
      // subject outside their scope.
      for (const prerequisite of found) {
        if (!scopeCanAccessSubject(scope, prerequisite)) {
          throw new BadRequestException(
            'A prerequisite must be a subject you are authorized to manage',
          );
        }
      }
    }
    return found;
  }

  private resolveWeights(
    projectWeight?: number,
    examWeight?: number,
  ): { projectWeight: number; examWeight: number } {
    if (projectWeight === undefined && examWeight === undefined) {
      // Phase 3 default grading weights for newly configured subjects:
      // 25% project + 75% exam (sums to 100, satisfying the check constraint).
      return { projectWeight: 25, examWeight: 75 };
    }
    if (projectWeight === undefined || examWeight === undefined) {
      throw new BadRequestException('Provide both projectWeight and examWeight together');
    }
    if (Math.abs(projectWeight + examWeight - 100) > 0.001) {
      throw new BadRequestException('projectWeight and examWeight must add up to 100');
    }
    return { projectWeight, examWeight };
  }

  private async ensureProgram(programId: string): Promise<void> {
    const exists = await this.programs.exists({ where: { id: programId } });
    if (!exists) {
      throw new BadRequestException('Academic program not found');
    }
  }

  private async save(subject: Subject): Promise<Subject> {
    try {
      return await this.subjects.save(subject);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Subject code uniqueness is scoped to the specialization (partial
        // unique index on (programId, code)); the same code may exist in
        // another program.
        throw new BadRequestException('A subject with this code already exists in this specialization');
      }
      throw error;
    }
  }
}
