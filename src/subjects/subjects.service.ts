import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
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

  async create(dto: CreateSubjectDto): Promise<Subject> {
    if (dto.programId) {
      await this.ensureProgram(dto.programId);
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
      programId: dto.programId ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.save(subject);
  }

  async findAll(query: QuerySubjectsDto): Promise<PaginatedResult<Subject>> {
    const qb = this.subjects
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.program', 'program')
      .orderBy('subject.code', 'ASC');
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

  async findOne(id: string): Promise<Subject> {
    const subject = await this.subjects.findOne({
      where: { id },
      relations: { program: true, prerequisites: true },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.findOne(id);
    if (dto.programId !== undefined) {
      if (dto.programId) {
        await this.ensureProgram(dto.programId);
      }
      subject.programId = dto.programId ?? null;
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
    const subject = await this.findOne(id);
    try {
      await this.subjects.remove(subject);
    } catch {
      throw new BadRequestException(
        'Subject cannot be deleted while sections reference it; deactivate it instead',
      );
    }
  }

  async getPrerequisites(id: string): Promise<Subject[]> {
    const subject = await this.findOne(id);
    return subject.prerequisites;
  }

  async setPrerequisites(id: string, prerequisiteIds: string[]): Promise<Subject[]> {
    const subject = await this.findOne(id);
    const prerequisites = await this.loadPrerequisites(id, prerequisiteIds);
    subject.prerequisites = prerequisites;
    const saved = await this.subjects.save(subject);
    return saved.prerequisites;
  }

  async addPrerequisite(id: string, prerequisiteId: string): Promise<Subject[]> {
    const subject = await this.findOne(id);
    const [found] = await this.loadPrerequisites(id, [prerequisiteId]);
    const existing = new Set(subject.prerequisites.map((p) => p.id));
    if (!existing.has(found.id)) {
      subject.prerequisites.push(found);
      await this.subjects.save(subject);
    }
    return this.getPrerequisites(id);
  }

  async removePrerequisite(id: string, prerequisiteId: string): Promise<Subject[]> {
    const subject = await this.findOne(id);
    subject.prerequisites = subject.prerequisites.filter((p) => p.id !== prerequisiteId);
    await this.subjects.save(subject);
    return subject.prerequisites;
  }

  private async loadPrerequisites(id: string, ids: string[]): Promise<Subject[]> {
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
    return found;
  }

  private resolveWeights(
    projectWeight?: number,
    examWeight?: number,
  ): { projectWeight: number; examWeight: number } {
    if (projectWeight === undefined && examWeight === undefined) {
      return { projectWeight: 0, examWeight: 100 };
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
        throw new BadRequestException('A subject with this code already exists');
      }
      throw error;
    }
  }
}
