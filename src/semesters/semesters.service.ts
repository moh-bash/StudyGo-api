import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { UserRole } from '../common/enums.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { scopeCanAccessSemester, type ResolvedScope } from '../users/academic-scope.js';
import { CreateSemesterDto } from './dto/create-semester.dto.js';
import { QuerySemestersDto } from './dto/query-semesters.dto.js';
import { UpdateSemesterDto } from './dto/update-semester.dto.js';
import { Semester } from './entities/semester.entity.js';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester) private readonly semesters: Repository<Semester>,
    @InjectRepository(AcademicProgram) private readonly programs: Repository<AcademicProgram>,
  ) {}

  async create(dto: CreateSemesterDto, scope: ResolvedScope): Promise<Semester> {
    const programId = this.resolveCreateProgram(dto.programId, scope);
    await this.ensureProgram(programId);
    this.assertDateRange(dto.startDate, dto.endDate);
    const semester = this.semesters.create({
      programId,
      name: dto.name.trim(),
      code: dto.code.trim(),
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      status: dto.status,
    });
    return this.save(semester);
  }

  async findAll(query: QuerySemestersDto, scope: ResolvedScope): Promise<PaginatedResult<Semester>> {
    const qb = this.semesters
      .createQueryBuilder('semester')
      .leftJoinAndSelect('semester.program', 'program')
      .orderBy('semester.startDate', 'DESC', 'NULLS LAST');
    this.applyScopeFilter(qb, scope);
    if (query.programId) {
      qb.andWhere('semester.programId = :programId', { programId: query.programId });
    }
    if (query.status) {
      qb.andWhere('semester.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('(semester.name ILIKE :search OR semester.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string, scope: ResolvedScope): Promise<Semester> {
    const semester = await this.semesters.findOne({ where: { id }, relations: { program: true } });
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }
    this.assertSemesterAccess(semester, scope);
    return semester;
  }

  async update(id: string, dto: UpdateSemesterDto, scope: ResolvedScope): Promise<Semester> {
    const semester = await this.findOne(id, scope);
    if (dto.programId !== undefined) {
      if (scope.role !== UserRole.ADMIN) {
        // The program is the boundary of a manager's authority: a semester can
        // never be moved into or out of a program by a manager.
        throw new ForbiddenException("Managers cannot change a semester's academic program");
      }
      await this.ensureProgram(dto.programId);
      semester.programId = dto.programId;
    }
    if (dto.name !== undefined) {
      semester.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      semester.code = dto.code.trim();
    }
    const start = dto.startDate !== undefined ? dto.startDate : semester.startDate;
    const end = dto.endDate !== undefined ? dto.endDate : semester.endDate;
    this.assertDateRange(start, end);
    semester.startDate = start;
    semester.endDate = end;
    if (dto.status !== undefined) {
      semester.status = dto.status;
    }
    return this.save(semester);
  }

  async remove(id: string, scope: ResolvedScope): Promise<void> {
    const semester = await this.findOne(id, scope);
    try {
      await this.semesters.remove(semester);
    } catch {
      throw new BadRequestException(
        'Semester cannot be deleted while sections reference it; mark it completed instead',
      );
    }
  }

  /**
   * A Program Manager may only create semesters inside their own program; the
   * program is forced. Admins choose freely.
   */
  private resolveCreateProgram(requested: string, scope: ResolvedScope): string {
    if (scope.role === UserRole.ADMIN) {
      return requested;
    }
    if (scope.role === UserRole.PROGRAM_MANAGER) {
      if (scope.programId === null) {
        throw new ForbiddenException('Manager account has no assigned academic program');
      }
      if (requested !== scope.programId) {
        throw new ForbiddenException('Managers may only create semesters in their assigned program');
      }
      return scope.programId;
    }
    throw new ForbiddenException('Your role cannot create semesters');
  }

  private assertSemesterAccess(semester: Semester, scope: ResolvedScope): void {
    if (!scopeCanAccessSemester(scope, semester.programId)) {
      // Out-of-scope semesters surface as 404 (not 403) so the API cannot be
      // used to probe for the existence of other programs' records.
      throw new NotFoundException('Semester not found');
    }
  }

  private applyScopeFilter(
    qb: ReturnType<Repository<Semester>['createQueryBuilder']>,
    scope: ResolvedScope,
  ): void {
    if (scope.role === UserRole.ADMIN) {
      return;
    }
    if (scope.programId === null) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('semester.programId = :scopeProgramId', { scopeProgramId: scope.programId });
  }

  private async ensureProgram(programId: string): Promise<void> {
    const exists = await this.programs.exists({ where: { id: programId } });
    if (!exists) {
      throw new BadRequestException('Academic program not found');
    }
  }

  private assertDateRange(start: string | null | undefined, end: string | null | undefined): void {
    if (start && end && start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }
  }

  private async save(semester: Semester): Promise<Semester> {
    try {
      return await this.semesters.save(semester);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('A semester with this code already exists in the program');
      }
      throw error;
    }
  }
}
