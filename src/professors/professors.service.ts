import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { CreateProfessorDto } from './dto/create-professor.dto.js';
import { QueryProfessorsDto } from './dto/query-professors.dto.js';
import { UpdateProfessorDto } from './dto/update-professor.dto.js';
import { Professor } from './entities/professor.entity.js';

@Injectable()
export class ProfessorsService {
  constructor(
    @InjectRepository(Professor) private readonly professors: Repository<Professor>,
  ) {}

  async create(dto: CreateProfessorDto): Promise<Professor> {
    const professor = this.professors.create({
      name: dto.name.trim(),
      email: dto.email?.trim().toLowerCase() || null,
      profileImageUrl: dto.profileImageUrl ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.save(professor);
  }

  async findAll(query: QueryProfessorsDto): Promise<PaginatedResult<Professor>> {
    const qb = this.professors.createQueryBuilder('professor').orderBy('professor.name', 'ASC');
    if (query.isActive !== undefined) {
      qb.andWhere('professor.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere('(professor.name ILIKE :search OR professor.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Professor> {
    const professor = await this.professors.findOne({ where: { id } });
    if (!professor) {
      throw new NotFoundException('Professor not found');
    }
    return professor;
  }

  async update(id: string, dto: UpdateProfessorDto): Promise<Professor> {
    const professor = await this.findOne(id);
    if (dto.name !== undefined) {
      professor.name = dto.name.trim();
    }
    if (dto.email !== undefined) {
      professor.email = dto.email?.trim().toLowerCase() || null;
    }
    if (dto.profileImageUrl !== undefined) {
      professor.profileImageUrl = dto.profileImageUrl;
    }
    if (dto.description !== undefined) {
      professor.description = dto.description;
    }
    if (dto.isActive !== undefined) {
      professor.isActive = dto.isActive;
    }
    return this.save(professor);
  }

  async remove(id: string): Promise<void> {
    const professor = await this.findOne(id);
    try {
      await this.professors.remove(professor);
    } catch {
      throw new BadRequestException(
        'Professor cannot be deleted while sections reference them; deactivate instead',
      );
    }
  }

  private async save(professor: Professor): Promise<Professor> {
    try {
      return await this.professors.save(professor);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('A professor with this email already exists');
      }
      throw error;
    }
  }
}
