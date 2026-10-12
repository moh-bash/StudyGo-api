import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { PASSWORD_REGEX } from '../auth/dto/register.dto.js';
import { AccountStatus, UserRole } from '../common/enums.js';
import { User } from '../users/entities/user.entity.js';

const BCRYPT_ROUNDS = 12;
const BOOTSTRAP_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('studygo:admin:bootstrap')::bigint)";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Establishes the first System Admin exactly once.
 *
 * Enablement: protected environment configuration (`ADMIN_EMAIL` +
 * `ADMIN_PASSWORD`). The credential is verified on the server (valid email,
 * password policy, no reuse of the JWT signing secret) before anything is
 * written. The check that decides "no admin exists yet" runs inside a
 * transaction guarded by a Postgres advisory lock, so concurrent startups
 * (e.g. multiple replicas booting together) cannot create two initial admins.
 * The database state is authoritative: once any ADMIN exists, bootstrap is a
 * no-op even if the env flags are accidentally left on. After a successful
 * bootstrap the operator must remove ADMIN_EMAIL/ADMIN_PASSWORD.
 *
 * Never exposes or logs the credential — only the target email is logged.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('admin.email');
    const password = this.config.get<string>('admin.password');
    if (!email || !password) {
      this.logger.debug(
        'Admin bootstrap disabled: set ADMIN_EMAIL and ADMIN_PASSWORD to enable it.',
      );
      return;
    }
    this.assertValidBootstrapCredential(email, password);
    await this.bootstrapInitialAdmin(email.trim().toLowerCase(), password);
  }

  private assertValidBootstrapCredential(email: string, password: string): void {
    if (!EMAIL_REGEX.test(email.trim())) {
      throw new Error('[bootstrap] ADMIN_EMAIL is not a valid email address.');
    }
    if (
      password.length < 8 ||
      password.length > 72 ||
      !PASSWORD_REGEX.test(password)
    ) {
      throw new Error(
        '[bootstrap] ADMIN_PASSWORD is rejected: use 8-72 characters with at least one letter and one number.',
      );
    }
    if (this.config.get<string>('jwt.accessSecret') === password) {
      throw new Error('[bootstrap] ADMIN_PASSWORD must not reuse the JWT signing secret.');
    }
  }

  private async bootstrapInitialAdmin(email: string, password: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Serializes concurrent bootstrap attempts (cluster-safe single-flight).
      await manager.query(BOOTSTRAP_LOCK_SQL);

      const userRepo = manager.getRepository(User);

      const adminCount = await userRepo.count({ where: { role: UserRole.ADMIN } });
      if (adminCount > 0) {
        this.logger.log(
          'Admin bootstrap skipped: an ADMIN account already exists. Remove ADMIN_EMAIL/ADMIN_PASSWORD.',
        );
        return;
      }

      const existing = await userRepo.findOne({ where: { email } });
      if (existing) {
        this.logger.warn(
          `Admin bootstrap skipped: email ${email} is already registered. Use a different email or remove ADMIN_EMAIL/ADMIN_PASSWORD.`,
        );
        return;
      }

      const admin = userRepo.create({
        fullName: 'System Admin',
        email,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
        profileImageUrl: null,
        studentUniversityId: null,
        programId: null,
      });
      await userRepo.save(admin);
      this.logger.log(
        `Initial System Admin created (${email}). Remove ADMIN_EMAIL/ADMIN_PASSWORD from the environment now.`,
      );
    });
  }
}