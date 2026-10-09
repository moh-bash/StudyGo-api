import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import { getSkip, buildPaginatedResult } from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { toUserResponse } from './user.mapper.js';
import { User } from './entities/user.entity.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
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
    this.applyProfileFields(user, dto);
    if (dto.role !== undefined) {
      user.role = dto.role;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
    }
    await this.save(user);
    return toUserResponse(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.getOrFail(id);
    await this.users.remove(user);
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
