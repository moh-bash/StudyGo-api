import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AccountStatus, UserRole } from '../common/enums.js';
import type { User } from '../users/entities/user.entity.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';

const EMAIL = 'root@studygo.example';
const PASSWORD = 'Bootstr0p!';
const JWT_SECRET = 'x'.repeat(64);
const REUSED_CREDENTIAL = 'Bootstr0p!Bootstr0p!Bootstr0p!Boot';

interface FakeUserRepo {
  count: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

interface Harness {
  service: AdminBootstrapService;
  userRepo: FakeUserRepo;
  lockCalls: string[];
  stats: { transactionCalls: number };
}

function makeHarness(options: {
  adminEmail?: string;
  adminPassword?: string;
  secret?: string;
  adminCount?: number;
  existingEmail?: User | null;
}): Harness {
  const adminCount = options.adminCount ?? 0;
  const existingEmail = options.existingEmail ?? null;

  const userRepo: FakeUserRepo = {
    count: vi.fn(async ({ where }) => (where.role === UserRole.ADMIN ? adminCount : 0)),
    findOne: vi.fn(async () => existingEmail),
    create: vi.fn((data) => ({ ...data }) as User),
    save: vi.fn(async (user) => user),
  };

  const lockCalls: string[] = [];
  const fakeManager = {
    query: vi.fn(async (sql: string) => {
      lockCalls.push(sql);
    }),
    getRepository: () => userRepo,
  } as unknown as EntityManager;

  const stats = { transactionCalls: 0 };
  const dataSource = {
    transaction: async (cb: (manager: EntityManager) => Promise<void>) => {
      stats.transactionCalls += 1;
      await cb(fakeManager);
    },
  } as unknown as DataSource;

  const config = {
    get: (key: string) => {
      if (key === 'admin.email') return options.adminEmail;
      if (key === 'admin.password') return options.adminPassword;
      if (key === 'jwt.accessSecret') return options.secret ?? JWT_SECRET;
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new AdminBootstrapService(
    userRepo as unknown as Repository<User>,
    dataSource,
    config,
  );
  return { service, userRepo, lockCalls, stats };
}

describe('AdminBootstrapService', () => {
  it('does nothing when bootstrap is not enabled', async () => {
    const h = makeHarness({ adminEmail: undefined, adminPassword: undefined });
    await h.service.onApplicationBootstrap();
    expect(h.stats.transactionCalls).toBe(0);
    expect(h.userRepo.save).not.toHaveBeenCalled();
  });

  it('fails when only one of the bootstrap variables is present', async () => {
    await expect(
      makeHarness({ adminEmail: EMAIL, adminPassword: undefined }).service.onApplicationBootstrap(),
    ).resolves.toBeUndefined();
    const partial = makeHarness({ adminEmail: undefined, adminPassword: PASSWORD });
    await partial.service.onApplicationBootstrap();
    expect(partial.stats.transactionCalls).toBe(0);
  });

  it('rejects an invalid bootstrap email before writing anything', async () => {
    const h = makeHarness({ adminEmail: 'not-an-email', adminPassword: PASSWORD });
    await expect(h.service.onApplicationBootstrap()).rejects.toThrow(/ADMIN_EMAIL/);
    expect(h.stats.transactionCalls).toBe(0);
  });

  it('rejects a weak bootstrap password', async () => {
    const h = makeHarness({ adminEmail: EMAIL, adminPassword: 'short' });
    await expect(h.service.onApplicationBootstrap()).rejects.toThrow(/ADMIN_PASSWORD/);
    expect(h.stats.transactionCalls).toBe(0);
  });

  it('rejects reusing the JWT signing secret as the bootstrap password', async () => {
    const h = makeHarness({
      adminEmail: EMAIL,
      adminPassword: REUSED_CREDENTIAL,
      secret: REUSED_CREDENTIAL,
    });
    await expect(h.service.onApplicationBootstrap()).rejects.toThrow(/must not reuse/);
    expect(h.stats.transactionCalls).toBe(0);
  });

  it('creates exactly one ADMIN when enabled and no admin exists yet', async () => {
    const h = makeHarness({ adminEmail: EMAIL, adminPassword: PASSWORD });
    await h.service.onApplicationBootstrap();

    expect(h.stats.transactionCalls).toBe(1);
    expect(h.lockCalls).toHaveLength(1);
    expect(h.lockCalls[0]).toMatch(/pg_advisory_xact_lock/);
    expect(h.userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ADMIN, email: EMAIL, programId: null }),
    );
    expect(h.userRepo.save).toHaveBeenCalledTimes(1);
  });

  it('is a no-op once an ADMIN already exists, even if the flag is left on', async () => {
    const h = makeHarness({ adminEmail: EMAIL, adminPassword: PASSWORD, adminCount: 1 });
    await h.service.onApplicationBootstrap();
    expect(h.stats.transactionCalls).toBe(1);
    expect(h.userRepo.save).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing account that shares the bootstrap email', async () => {
    const existing = {
      id: 'u-1',
      email: EMAIL,
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
    } as User;
    const h = makeHarness({
      adminEmail: EMAIL,
      adminPassword: PASSWORD,
      existingEmail: existing,
    });
    await h.service.onApplicationBootstrap();
    expect(h.userRepo.save).not.toHaveBeenCalled();
  });

  it('ensures the advisory lock is acquired before the authority check', async () => {
    const h = makeHarness({ adminEmail: EMAIL, adminPassword: PASSWORD });
    const order: string[] = [];
    h.userRepo.count.mockImplementationOnce(async () => {
      order.push('count');
      return 0;
    });
    await h.service.onApplicationBootstrap();
    expect(h.lockCalls[0]).toMatch(/pg_advisory_xact_lock/);
  });

  it('stores a hashed password and never returns the bootstrap password', async () => {
    const h = makeHarness({ adminEmail: EMAIL, adminPassword: PASSWORD });
    await h.service.onApplicationBootstrap();
    const saved = h.userRepo.save.mock.calls[0]?.[0] as User;
    expect(saved.passwordHash).toBeTruthy();
    expect(saved.passwordHash).not.toBe(PASSWORD);
    expect(JSON.stringify(saved)).not.toContain(PASSWORD);
  });
});