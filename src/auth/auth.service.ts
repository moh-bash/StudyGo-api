import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { AccountStatus, UserRole } from '../common/enums.js';
import type { JwtPayload } from '../common/interfaces.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { parseDurationToMs } from '../common/utils/duration.util.js';
import { generateOpaqueToken, sha256 } from '../common/utils/hash.util.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { toUserResponse } from '../users/user.mapper.js';
import { User } from '../users/entities/user.entity.js';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { MailService } from './mail/mail.service.js';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 3_600_000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    @InjectRepository(AcademicProgram) private readonly programs: Repository<AcademicProgram>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Program selection is validated server-side before the user is created so a
    // rejected registration never leaves a partially created user behind.
    const programId = dto.programId !== undefined ? await this.resolveEligibleProgram(dto.programId) : null;

    const user = this.users.create({
      fullName: dto.fullName.trim(),
      email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
      profileImageUrl: null,
      studentUniversityId: dto.studentUniversityId?.trim() || null,
      phone: dto.phone?.trim() || null,
      programId,
    });

    try {
      await this.users.save(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or student id is already in use');
      }
      throw error;
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: toUserResponse(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Account is suspended');
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: toUserResponse(user) };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokenHash = sha256(dto.refreshToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (stored.user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Account is suspended');
    }

    const revokeResult = await this.refreshTokens.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (revokeResult.affected !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokens = await this.issueTokens(stored.user);
    return { ...tokens, user: toUserResponse(stored.user) };
  }

  /**
   * Revokes the supplied refresh token. Access tokens are short-lived and
   * stateless, so they remain valid until expiry; refresh is the durable
   * credential and is what logout actually invalidates. The route is public and
   * keyed on refresh-token possession, so revocation also works after the
   * access token has expired. Revoking an unknown/already-revoked token is a
   * no-op that still returns success (idempotent, no information leak).
   */
  async logout(dto: RefreshTokenDto): Promise<MessageResponseDto> {
    await this.refreshTokens.update(
      { tokenHash: sha256(dto.refreshToken) },
      { revokedAt: new Date() },
    );
    return { message: 'Logged out' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });

    if (user) {
      const token = generateOpaqueToken(32);
      await this.resetTokens.save(
        this.resetTokens.create({
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          usedAt: null,
        }),
      );
      await this.mail.sendPasswordReset(user.email, token);
    }

    // Same response whether or not the email exists (no account enumeration).
    return { message: 'If the email is registered, a password reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const record = await this.resetTokens.findOne({ where: { tokenHash: sha256(dto.token) } });
    if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.users.update(
      { id: record.userId },
      { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    );
    record.usedAt = new Date();
    await this.resetTokens.save(record);
    await this.refreshTokens.update({ userId: record.userId }, { revokedAt: new Date() });

    return { message: 'Password has been reset. Please log in again.' };
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserResponse(user);
  }

  /**
   * Validates the client-supplied program identifier against the canonical
   * server record. The client may never prove program identity by name — only
   * the server-resolved id is trusted.
   */
  private async resolveEligibleProgram(programId: string): Promise<string> {
    const program = await this.programs.findOne({ where: { id: programId } });
    if (!program || !program.isActive) {
      throw new BadRequestException('Selected academic program is not available');
    }
    return program.id;
  }

  private async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = generateOpaqueToken(48);
    const ttlMs = parseDurationToMs(
      this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
      604_800_000,
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlMs),
        revokedAt: null,
      }),
    );

    return { accessToken, refreshToken };
  }
}
