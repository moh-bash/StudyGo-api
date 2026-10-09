import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
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

  async create(dto: CreateSemesterDto): Promise<Semester> {
    await this.ensureProgram(dto.programId);
    this.assertDateRange(dto.startDate, dto.endDate);
    const semester = this.semesters.create({
      programId: dto.programId,
      name: dto.name.trim(),
      code: dto.code.trim(),
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      status: dto.status,
    });
    return this.save(semester);
  }

  async findAll(query: QuerySemestersDto): Promise<PaginatedResult<Semester>> {
    const qb = this.semesters
      .createQueryBuilder('semester')
      .leftJoinAndSelect('semester.program', 'program')
      .orderBy('semester.startDate', 'DESC', 'NULLS LAST');
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

  async findOne(id: string): Promise<Semester> {
    const semester = await this.semesters.findOne({ where: { id }, relations: { program: true } });
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }
    return semester;
  }

  async update(id: string, dto: UpdateSemesterDto): Promise<Semester> {
    const semester = await this.findOne(id);
    if (dto.programId !== undefined) {
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

  async remove(id: string): Promise<void> {
    const semester = await this.findOne(id);
    try {
      await this.semesters.remove(semester);
    } catch {
      throw new BadRequestException(
        'Semester cannot be deleted while sections reference it; mark it completed instead',
      );
    }
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
