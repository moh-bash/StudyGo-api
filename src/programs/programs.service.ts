import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { QueryProgramsDto } from './dto/query-programs.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { AcademicProgram } from './entities/program.entity.js';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(AcademicProgram)
    private readonly programs: Repository<AcademicProgram>,
  ) {}

  async create(dto: CreateProgramDto): Promise<AcademicProgram> {
    const program = this.programs.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.save(program);
  }

  async findAll(query: QueryProgramsDto): Promise<PaginatedResult<AcademicProgram>> {
    const qb = this.programs.createQueryBuilder('program').orderBy('program.name', 'ASC');
    if (query.isActive !== undefined) {
      qb.andWhere('program.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere('(program.name ILIKE :search OR program.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<AcademicProgram> {
    const program = await this.programs.findOne({ where: { id } });
    if (!program) {
      throw new NotFoundException('Academic program not found');
    }
    return program;
  }

  async update(id: string, dto: UpdateProgramDto): Promise<AcademicProgram> {
    const program = await this.findOne(id);
    if (dto.name !== undefined) {
      program.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      program.code = dto.code?.trim() || null;
    }
    if (dto.description !== undefined) {
      program.description = dto.description;
    }
    if (dto.isActive !== undefined) {
      program.isActive = dto.isActive;
    }
    return this.save(program);
  }

  async remove(id: string): Promise<void> {
    const program = await this.findOne(id);
    try {
      await this.programs.remove(program);
    } catch {
      throw new BadRequestException(
        'Program cannot be deleted while semesters or subjects reference it; deactivate it instead',
      );
    }
  }

  private async save(program: AcademicProgram): Promise<AcademicProgram> {
    try {
      return await this.programs.save(program);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('A program with this code already exists');
      }
      throw error;
    }
  }
}
