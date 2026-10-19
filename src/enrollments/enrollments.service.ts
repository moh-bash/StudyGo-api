import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import { calculateTotalMark } from '../common/utils/grade.util.js';
import { percentageToBand } from '../common/utils/grading.util.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { EnrollmentStatus, UserRole } from '../common/enums.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { UpdateMarksDto } from './dto/update-marks.dto.js';
import { StudentEnrollment } from './entities/enrollment.entity.js';

export interface GpaEntryResult {
  enrollmentId: string;
  subjectCode: string;
  subjectNameEn: string;
  creditHours: number;
  totalMark: number;
  letter: string;
  points: number;
}

export interface GpaSummary {
  gpa: number | null;
  gradedCredits: number;
  entries: GpaEntryResult[];
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(StudentEnrollment)
    private readonly enrollments: Repository<StudentEnrollment>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateEnrollmentDto): Promise<StudentEnrollment> {
    const studentId = dto.studentId ?? actor.id;
    if (studentId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can enroll other students');
    }

    const section = await this.sections.findOne({
      where: { id: dto.sectionId },
      relations: { subject: true },
    });
    if (!section) {
      throw new BadRequestException('Section not found');
    }
    if (!section.isActive) {
      throw new BadRequestException('Section is not open for enrollment');
    }
    if (actor.role !== UserRole.ADMIN) {
      // Narrow authorization fix (audit F-03): a student may only enroll in
      // sections whose subject belongs to their own academic program. The
      // program is re-read from the database, never trusted from the client.
      const student = await this.users.findOne({ where: { id: studentId } });
      const studentProgramId = student?.programId ?? null;
      const subjectProgramId = section.subject?.programId ?? null;
      if (
        studentProgramId === null ||
        subjectProgramId === null ||
        studentProgramId !== subjectProgramId
      ) {
        throw new ForbiddenException(
          'Students can only enroll in sections of their own academic program',
        );
      }
    }

    await this.assertCapacity(section);
    await this.assertPrerequisites(studentId, section.subjectId);

    const existing = await this.enrollments.findOne({
      where: { studentId, sectionId: dto.sectionId },
    });
    if (existing) {
      if (existing.status !== EnrollmentStatus.DROPPED) {
        throw new BadRequestException('Student is already enrolled in this section');
      }
      existing.status = EnrollmentStatus.ENROLLED;
      return this.save(existing);
    }

    const enrollment = this.enrollments.create({
      studentId,
      sectionId: dto.sectionId,
      status: EnrollmentStatus.ENROLLED,
    });
    return this.save(enrollment);
  }

  async findAll(query: QueryEnrollmentsDto): Promise<PaginatedResult<StudentEnrollment>> {
    const qb = this.buildQuery(query);
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findMine(
    studentId: string,
    query: QueryEnrollmentsDto,
  ): Promise<PaginatedResult<StudentEnrollment>> {
    const qb = this.buildQuery({ ...query, studentId });
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<StudentEnrollment> {
    const enrollment = await this.enrollments.findOne({
      where: { id },
      relations: {
        student: true,
        section: { subject: true, semester: true, professor: true },
      },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    if (actor.role !== UserRole.ADMIN && enrollment.studentId !== actor.id) {
      throw new ForbiddenException('You can only view your own enrollments');
    }
    return enrollment;
  }

  async update(id: string, dto: UpdateEnrollmentDto): Promise<StudentEnrollment> {
    const enrollment = await this.getOrFail(id);
    if (dto.status !== undefined) {
      enrollment.status = dto.status;
    }
    return this.save(enrollment);
  }

  async recordMarks(id: string, dto: UpdateMarksDto): Promise<StudentEnrollment> {
    const enrollment = await this.getOrFail(id);
    const section = await this.sections.findOne({
      where: { id: enrollment.sectionId },
      relations: { subject: true },
    });
    if (!section) {
      throw new BadRequestException('Section not found');
    }
    if (dto.projectMark !== undefined) {
      enrollment.projectMark = dto.projectMark;
    }
    if (dto.examMark !== undefined) {
      enrollment.examMark = dto.examMark;
    }
    const subject = section.subject;
    enrollment.totalMark = calculateTotalMark(
      enrollment.projectMark,
      enrollment.examMark,
      subject.projectWeight,
      subject.examWeight,
    );
    enrollment.isVerified = dto.isVerified ?? true;
    return this.save(enrollment);
  }

  async drop(actor: AuthenticatedUser, id: string): Promise<StudentEnrollment> {
    const enrollment = await this.getOrFail(id);
    if (actor.role !== UserRole.ADMIN && enrollment.studentId !== actor.id) {
      throw new ForbiddenException('You can only drop your own enrollments');
    }
    enrollment.status = EnrollmentStatus.DROPPED;
    return this.save(enrollment);
  }

  async remove(id: string): Promise<void> {
    const enrollment = await this.getOrFail(id);
    await this.enrollments.remove(enrollment);
  }

  async gpaForStudent(studentId: string): Promise<GpaSummary> {
    const enrollments = await this.enrollments.find({
      where: {
        studentId,
        status: In([EnrollmentStatus.COMPLETED, EnrollmentStatus.ENROLLED]),
      },
      relations: { section: { subject: true } },
    });

    const entries: GpaEntryResult[] = [];
    let weighted = 0;
    let credits = 0;
    for (const enrollment of enrollments) {
      const totalMark = enrollment.totalMark;
      const subject = enrollment.section?.subject;
      if (totalMark === null || totalMark === undefined || !subject) {
        continue;
      }
      const band = percentageToBand(totalMark);
      if (!band) {
        continue;
      }
      entries.push({
        enrollmentId: enrollment.id,
        subjectCode: subject.code,
        subjectNameEn: subject.nameEn,
        creditHours: subject.creditHours,
        totalMark,
        letter: band.letter,
        points: band.points,
      });
      weighted += band.points * subject.creditHours;
      credits += subject.creditHours;
    }

    const gpa = credits > 0 ? Math.round((weighted / credits + Number.EPSILON) * 100) / 100 : null;
    return { gpa, gradedCredits: credits, entries };
  }

  private buildQuery(query: QueryEnrollmentsDto) {
    const qb = this.enrollments
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('enrollment.section', 'section')
      .leftJoinAndSelect('section.subject', 'subject')
      .leftJoinAndSelect('section.semester', 'semester')
      .orderBy('enrollment.createdAt', 'DESC');
    if (query.studentId) {
      qb.andWhere('enrollment.studentId = :studentId', { studentId: query.studentId });
    }
    if (query.sectionId) {
      qb.andWhere('enrollment.sectionId = :sectionId', { sectionId: query.sectionId });
    }
    if (query.semesterId) {
      qb.andWhere('section.semesterId = :semesterId', { semesterId: query.semesterId });
    }
    if (query.subjectId) {
      qb.andWhere('section.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.status) {
      qb.andWhere('enrollment.status = :status', { status: query.status });
    }
    return qb;
  }

  private async getOrFail(id: string): Promise<StudentEnrollment> {
    const enrollment = await this.enrollments.findOne({ where: { id } });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    return enrollment;
  }

  private async assertCapacity(section: AcademicSection): Promise<void> {
    if (section.capacity === null || section.capacity === undefined) {
      return;
    }
    const count = await this.enrollments.count({
      where: { sectionId: section.id, status: EnrollmentStatus.ENROLLED },
    });
    if (count >= section.capacity) {
      throw new BadRequestException('Section is full');
    }
  }

  private async assertPrerequisites(studentId: string, subjectId: string): Promise<void> {
    const subject = await this.subjects.findOne({
      where: { id: subjectId },
      relations: { prerequisites: true },
    });
    if (!subject || subject.prerequisites.length === 0) {
      return;
    }
    const completed = await this.enrollments.find({
      where: { studentId, status: EnrollmentStatus.COMPLETED },
      relations: { section: true },
    });
    const completedSubjectIds = new Set(completed.map((e) => e.section.subjectId));
    const missing = subject.prerequisites.filter((p) => !completedSubjectIds.has(p.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing prerequisites: ${missing.map((m) => m.code).join(', ')}`,
      );
    }
  }

  private async save(enrollment: StudentEnrollment): Promise<StudentEnrollment> {
    try {
      return await this.enrollments.save(enrollment);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('Student is already enrolled in this section');
      }
      throw error;
    }
  }
}
