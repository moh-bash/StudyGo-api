import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, In, Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { getSkip, buildPaginatedResult } from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { UserRole, isManagerRole } from '../common/enums.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { managedProgramId } from './academic-scope.js';
import { AcademicAssignmentsDto } from './dto/academic-assignments.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { toUserResponse } from './user.mapper.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import { User } from './entities/user.entity.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(AcademicProgram) private readonly programs: Repository<AcademicProgram>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(SubjectManagerAssignment)
    private readonly subjectManagerAssignments: Repository<SubjectManagerAssignment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findMe(userId: string): Promise<UserResponseDto> {
    return toUserResponse(await this.getOrFail(userId));
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.getOrFail(userId);
    this.applyProfileFields(user, dto);
    await this.save(user);
    return toUserResponse(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.save(user);
    // Invalidate all refresh sessions so other devices must re-authenticate.
    await this.refreshTokens.update({ userId }, { revokedAt: new Date() });
    return { message: 'Password changed successfully' };
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserResponseDto>> {
    const qb = this.users.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('(user.fullName ILIKE :search OR user.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    return buildPaginatedResult(rows.map(toUserResponse), total, query.page, query.limit);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return toUserResponse(await this.getOrFail(id));
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.getOrFail(id);
    const previousProgramId = user.programId;
    this.applyProfileFields(user, dto);
    let roleChanged = false;
    if (dto.role !== undefined) {
      // Manager roles carry an integrity-checked scope and must be granted
      // through the dedicated academic-assignment endpoints, never a bare role
      // flip that could create a manager with no program/subjects.
      if (isManagerRole(dto.role)) {
        throw new BadRequestException(
          'Assign PROGRAM_MANAGER/SUBJECT_MANAGER through the academic-assignments endpoints',
        );
      }
      user.role = dto.role;
      roleChanged = true;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
    }
    if (dto.programId !== undefined) {
      if (dto.programId === null) {
        if (isManagerRole(user.role)) {
          throw new BadRequestException('Cannot clear the program of a manager account');
        }
        user.programId = null;
      } else {
        user.programId = (await this.findProgram(dto.programId)).id;
      }
    }
    const programChanged = dto.programId !== undefined && user.programId !== previousProgramId;
    if (programChanged && user.role === UserRole.SUBJECT_MANAGER) {
      // Changing a Subject Manager's program invalidates every explicit subject
      // assignment (they belonged to the previous program). Clear them and revert
      // to STUDENT so no stale/orphaned grant survives; the admin re-assigns.
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(SubjectManagerAssignment, { userId: user.id });
        user.role = UserRole.STUDENT;
        await manager.save(user);
      });
      return toUserResponse(user);
    }
    await this.save(user);
    // A user who is no longer a Subject Manager must not retain assignments.
    if (roleChanged && user.role !== UserRole.SUBJECT_MANAGER) {
      await this.subjectManagerAssignments.delete({ userId: user.id });
    }
    return toUserResponse(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.getOrFail(id);
    await this.users.remove(user);
  }

  // --- Academic role / assignment management (System Admin only) ---

  /** Inspect a user's role and academic management scope (no secrets). */
  async getAcademicAssignments(userId: string): Promise<AcademicAssignmentsDto> {
    const user = await this.getOrFail(userId);
    const subjectIds = await this.loadManagedSubjectIds(user);
    return this.toAssignmentsDto(user, subjectIds);
  }

  /**
   * Assign (or reassign) a Program Manager. The managed program and the user's
   * own program are set together, so the manager can only ever manage this one
   * program. Any prior subject-manager scope is cleared.
   */
  async assignProgramManager(userId: string, programId: string): Promise<AcademicAssignmentsDto> {
    const user = await this.getOrFail(userId);
    this.assertNotSystemAdmin(user);
    const program = await this.findProgram(programId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SubjectManagerAssignment, { userId });
      user.role = UserRole.PROGRAM_MANAGER;
      user.programId = program.id;
      await manager.save(user);
    });
    return this.getAcademicAssignments(userId);
  }

  /** Remove Program Manager scope; the user reverts to STUDENT (keeps program). */
  async removeProgramManager(userId: string): Promise<AcademicAssignmentsDto> {
    const user = await this.getOrFail(userId);
    this.assertNotSystemAdmin(user);
    if (user.role === UserRole.PROGRAM_MANAGER) {
      user.role = UserRole.STUDENT;
      await this.users.save(user);
    }
    return this.getAcademicAssignments(userId);
  }

  /**
   * Replace the full set of Subject Manager assignments. Every subject must
   * exist and belong to the user's own program; unprogrammed subjects are
   * rejected. An empty list removes all assignments and reverts to STUDENT.
   */
  async setSubjectManagers(
    userId: string,
    subjectIds: string[],
    programId?: string,
  ): Promise<AcademicAssignmentsDto> {
    const user = await this.getOrFail(userId);
    this.assertNotSystemAdmin(user);
    const unique = [...new Set(subjectIds)];

    // Optionally set (or move) the user's program in the same atomic call, so the
    // admin never has to leave the account momentarily without a program.
    if (programId !== undefined) {
      user.programId = (await this.findProgram(programId)).id;
    }
    const targetProgramId = user.programId;

    if (unique.length === 0) {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(SubjectManagerAssignment, { userId });
        if (user.role === UserRole.SUBJECT_MANAGER) {
          user.role = UserRole.STUDENT;
        }
        await manager.save(user);
      });
      return this.getAcademicAssignments(userId);
    }

    if (targetProgramId === null) {
      throw new BadRequestException(
        'The user must have an academic program before subjects can be assigned',
      );
    }
    const subjects = await this.subjects.find({ where: { id: In(unique) } });
    if (subjects.length !== unique.length) {
      throw new BadRequestException('One or more subjects do not exist');
    }
    for (const subject of subjects) {
      if (subject.programId === null) {
        throw new BadRequestException(
          `Subject ${subject.id} has no academic program and cannot be managed`,
        );
      }
      if (subject.programId !== targetProgramId) {
        throw new BadRequestException(
          `Subject ${subject.id} does not belong to the user's academic program`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SubjectManagerAssignment, { userId });
      const rows = subjects.map((subject) =>
        manager.create(SubjectManagerAssignment, { userId, subjectId: subject.id }),
      );
      await manager.save(rows);
      user.role = UserRole.SUBJECT_MANAGER;
      user.programId = targetProgramId;
      await manager.save(user);
    });
    return this.getAcademicAssignments(userId);
  }

  /** Remove one subject-manager assignment; reverts to STUDENT if none remain. */
  async removeSubjectManager(userId: string, subjectId: string): Promise<AcademicAssignmentsDto> {
    const user = await this.getOrFail(userId);
    this.assertNotSystemAdmin(user);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SubjectManagerAssignment, { userId, subjectId });
      const remaining = await manager.count(SubjectManagerAssignment, { where: { userId } });
      if (remaining === 0 && user.role === UserRole.SUBJECT_MANAGER) {
        user.role = UserRole.STUDENT;
        await manager.save(user);
      }
    });
    return this.getAcademicAssignments(userId);
  }

  private async loadManagedSubjectIds(user: User): Promise<string[]> {
    if (user.role !== UserRole.SUBJECT_MANAGER) {
      return [];
    }
    const rows = await this.subjectManagerAssignments.find({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => row.subjectId);
  }

  private toAssignmentsDto(user: User, managedSubjectIds: string[]): AcademicAssignmentsDto {
    return {
      userId: user.id,
      role: user.role,
      programId: user.programId ?? null,
      managedProgramId: managedProgramId(user),
      managedSubjectIds,
    };
  }

  /** System Admin accounts are global and never carry academic management scope. */
  private assertNotSystemAdmin(user: User): void {
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'System Admin accounts cannot hold academic management assignments',
      );
    }
  }

  async updateProfileImage(userId: string, url: string | null): Promise<UserResponseDto> {
    const user = await this.getOrFail(userId);
    user.profileImageUrl = url;
    await this.save(user);
    return toUserResponse(user);
  }

  private async getOrFail(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Admin-only program assignment: the program must exist. (Any status,
   * including inactive, is allowed here so operators can pre-assign accounts.)
   */
  private async findProgram(id: string): Promise<AcademicProgram> {
    const program = await this.programs.findOne({ where: { id } });
    if (!program) {
      throw new NotFoundException('Academic program not found');
    }
    return program;
  }

  private applyProfileFields(user: User, dto: UpdateProfileDto): void {
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim();
    }
    if (dto.profileImageUrl !== undefined) {
      user.profileImageUrl = dto.profileImageUrl === '' ? null : dto.profileImageUrl;
    }
    if (dto.studentUniversityId !== undefined) {
      const normalized = dto.studentUniversityId?.trim();
      user.studentUniversityId = normalized ? normalized : null;
    }
  }

  private async save(user: User): Promise<void> {
    try {
      await this.users.save(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('Email or student id is already in use');
      }
      throw error;
    }
  }
}
