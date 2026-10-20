import { describe, expect, it, vi } from 'vitest';
import {
  JoinRequestStatus,
  TeamContactMethod,
  TeamScope,
  TeamStatus,
} from '../common/enums.js';
import { AdminTeamsService } from './admin-teams.service.js';
import type { StudyTeam } from './entities/study-team.entity.js';

const TERM = '00000000-0000-4000-8000-000000000001';
const SUBJ = '00000000-0000-4000-8000-000000000002';
const TEAM_A = '00000000-0000-4000-8000-00000000000a';
const TEAM_B = '00000000-0000-4000-8000-00000000000b';

/**
 * A chainable query-builder stand-in. Records the WHERE fragments applied and
 * answers `getManyAndCount`/`getCount` from the supplied fixture so the service
 * logic and its filters can be asserted without a database.
 */
function fakeQb(result: { rows: unknown[]; count: number }) {
  const state = { wheres: [] as string[], skip: 0, take: 0 };
  const qb: Record<string, unknown> = {
    leftJoinAndSelect: vi.fn(() => qb),
    where: vi.fn((clause: string) => {
      state.wheres.push(clause);
      return qb;
    }),
    andWhere: vi.fn((clause: string) => {
      state.wheres.push(clause);
      return qb;
    }),
    orderBy: vi.fn(() => qb),
    skip: vi.fn((n: number) => {
      state.skip = n;
      return qb;
    }),
    take: vi.fn((n: number) => {
      state.take = n;
      return qb;
    }),
    getManyAndCount: vi.fn(async () => [result.rows, result.count]),
    getCount: vi.fn(async () => result.count),
    _state: state,
  };
  return qb;
}

function team(over: Partial<StudyTeam> = {}): StudyTeam {
  return {
    id: TEAM_A,
    name: 'Team A',
    description: 'desc',
    subjectId: SUBJ,
    subject: { nameAr: 'مادة', nameEn: 'Subject', code: 'S1' },
    semesterId: TERM,
    semester: { name: 'خريف', code: 'T1' },
    sectionId: '00000000-0000-4000-8000-0000000000c1',
    section: { code: 'A1' },
    professorId: '00000000-0000-4000-8000-0000000000p1',
    professor: { name: 'Prof One' },
    scope: TeamScope.SECTION,
    creatorId: '00000000-0000-4000-8000-0000000000u1',
    creator: { fullName: 'Creator One' },
    maxMembers: 3,
    memberCount: 0,
    contactMethod: TeamContactMethod.TELEGRAM,
    contactValue: 'secret_handle',
    status: TeamStatus.ACTIVE,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  } as unknown as StudyTeam;
}

function build(over: {
  rows?: unknown[];
  count?: number;
  memberships?: unknown[];
  slots?: unknown[];
  pendingRequests?: unknown[];
  membershipCount?: number;
  openSlotCount?: number;
  pendingCount?: number;
  teamCount?: number;
} = {}) {
  const teams = {
    count: vi.fn(async () => over.teamCount ?? over.count ?? 0),
    createQueryBuilder: vi.fn(() =>
      fakeQb({ rows: over.rows ?? [], count: over.count ?? 0 }),
    ),
  };
  const memberships = {
    count: vi.fn(async () => over.membershipCount ?? (over.memberships ?? []).length),
    find: vi.fn(async () => over.memberships ?? []),
  };
  const slots = {
    createQueryBuilder: vi.fn(() => fakeQb({ rows: [], count: over.openSlotCount ?? 0 })),
    find: vi.fn(async () => over.slots ?? []),
  };
  const requests = {
    createQueryBuilder: vi.fn(() => fakeQb({ rows: [], count: over.pendingCount ?? 0 })),
    find: vi.fn(async () => over.pendingRequests ?? []),
  };
  const service = new AdminTeamsService(
    teams as never,
    memberships as never,
    slots as never,
    requests as never,
  );
  return { service, teams, memberships, slots, requests };
}

describe('AdminTeamsService', () => {
  it('counts teams with a database count, not a page', async () => {
    const { service, teams } = build({ teamCount: 42 });
    await expect(service.countTeams()).resolves.toBe(42);
    expect(teams.count).toHaveBeenCalledTimes(1);
  });

  it('reports zero for an empty database without error', async () => {
    const { service } = build({ teamCount: 0 });
    await expect(service.getStats()).resolves.toEqual({
      totalTeams: 0,
      totalMembers: 0,
      totalOpenSlots: 0,
      totalPendingRequests: 0,
    });
  });

  it('aggregates team stats from the database', async () => {
    const { service } = build({
      teamCount: 5,
      membershipCount: 12,
      openSlotCount: 7,
      pendingCount: 3,
    });
    await expect(service.getStats()).resolves.toEqual({
      totalTeams: 5,
      totalMembers: 12,
      totalOpenSlots: 7,
      totalPendingRequests: 3,
    });
  });

  it('lists teams with pagination metadata reflecting the global total', async () => {
    const { service } = build({ rows: [team()], count: 25 });
    const page = await service.listTeams({ page: 2, limit: 10 } as never);
    expect(page.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(page.data).toHaveLength(1);
  });

  it('never exposes the raw contact destination to administrators', async () => {
    const { service } = build({ rows: [team()], count: 1 });
    const page = await service.listTeams({ page: 1, limit: 20 } as never);
    const view = page.data[0] as Record<string, unknown>;
    expect(view.contactMethod).toBe(TeamContactMethod.TELEGRAM);
    expect(view).not.toHaveProperty('contactValue');
    expect(JSON.stringify(view)).not.toContain('secret_handle');
  });

  it('enriches a page with batched member / slot / request counts (no N+1)', async () => {
    const { service, memberships, slots, requests } = build({
      rows: [team({ id: TEAM_A }), team({ id: TEAM_B })],
      count: 2,
      memberships: [
        { teamId: TEAM_A, userId: 'u1' },
        { teamId: TEAM_A, userId: 'u2' },
        { teamId: TEAM_B, userId: 'u3' },
      ],
      slots: [
        { teamId: TEAM_A, state: 'OPEN' },
        { teamId: TEAM_A, state: 'JOINED' },
        { teamId: TEAM_B, state: 'OPEN' },
      ],
      pendingRequests: [
        { teamId: TEAM_A, status: JoinRequestStatus.PENDING },
      ],
    });
    const page = await service.listTeams({ page: 1, limit: 20 } as never);
    expect(memberships.find).toHaveBeenCalledTimes(1);
    expect(slots.find).toHaveBeenCalledTimes(1);
    expect(requests.find).toHaveBeenCalledTimes(1);
    const [a, b] = page.data;
    expect(a.memberCount).toBe(2);
    expect(a.openSlotCount).toBe(1);
    expect(a.pendingRequestCount).toBe(1);
    expect(b.memberCount).toBe(1);
    expect(b.openSlotCount).toBe(1);
  });

  it('applies every filter as a WHERE clause', async () => {
    const { service, teams } = build({ rows: [], count: 0 });
    await service.listTeams({
      page: 1,
      limit: 20,
      semesterId: TERM,
      subjectId: SUBJ,
      sectionId: '00000000-0000-4000-8000-0000000000c1',
      professorId: '00000000-0000-4000-8000-0000000000p1',
      scope: TeamScope.PROFESSOR,
      status: TeamStatus.ACTIVE,
      search: 'alpha',
    } as never);
    const qb = (teams.createQueryBuilder as ReturnType<typeof vi.fn>).mock.results[0].value;
    const wheres = (qb._state as { wheres: string[] }).wheres.join(' | ');
    expect(wheres).toContain('team.semesterId = :semesterId');
    expect(wheres).toContain('team.subjectId = :subjectId');
    expect(wheres).toContain('team.sectionId = :sectionId');
    expect(wheres).toContain('team.professorId = :professorId');
    expect(wheres).toContain('team.scope = :scope');
    expect(wheres).toContain('team.status = :status');
    expect(wheres).toContain('ILIKE :search');
  });

  it('omits filters that were not supplied', async () => {
    const { service, teams } = build({ rows: [], count: 0 });
    await service.listTeams({ page: 1, limit: 20 } as never);
    const qb = (teams.createQueryBuilder as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((qb._state as { wheres: string[] }).wheres).toHaveLength(0);
  });

  it('returns an empty page without touching the batch queries', async () => {
    const { service, memberships, slots, requests } = build({ rows: [], count: 0 });
    const page = await service.listTeams({ page: 1, limit: 20 } as never);
    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
    expect(memberships.find).not.toHaveBeenCalled();
    expect(slots.find).not.toHaveBeenCalled();
    expect(requests.find).not.toHaveBeenCalled();
  });

  it('maps subject, term, section, professor and creator display fields', async () => {
    const { service } = build({ rows: [team()], count: 1 });
    const page = await service.listTeams({ page: 1, limit: 20 } as never);
    const v = page.data[0];
    expect(v.subjectName).toBe('مادة');
    expect(v.subjectCode).toBe('S1');
    expect(v.semesterName).toBe('خريف');
    expect(v.sectionCode).toBe('A1');
    expect(v.professorName).toBe('Prof One');
    expect(v.creatorName).toBe('Creator One');
    expect(v.scope).toBe(TeamScope.SECTION);
    expect(v.status).toBe(TeamStatus.ACTIVE);
  });
});
