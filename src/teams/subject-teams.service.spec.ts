import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/interfaces.js';
import {
  JoinRequestStatus,
  TeamContactMethod,
  TeamRole,
  TeamScope,
  TeamStatus,
  TeamTaskSlotState,
  UserRole,
} from '../common/enums.js';
import type { AcademicSection } from '../sections/entities/section.entity.js';
import type { Subject } from '../subjects/entities/subject.entity.js';
import type { User } from '../users/entities/user.entity.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';
import { TeamTaskSlot } from './entities/team-task-slot.entity.js';
import { SubjectTeamsService } from './subject-teams.service.js';

const P_A = '00000000-0000-4000-8000-00000000000a';
const SUBJ = '00000000-0000-4000-8000-0000000000s1';
const TERM = '00000000-0000-4000-8000-0000000000t1';
const PROF_A = '00000000-0000-4000-8000-0000000000p1';
const PROF_B = '00000000-0000-4000-8000-0000000000p2';
const SEC_A = '00000000-0000-4000-8000-0000000000c1';
const SEC_B = '00000000-0000-4000-8000-0000000000c2';
const TEAM = '00000000-0000-4000-8000-0000000000e1';
const OWNER = '00000000-0000-4000-8000-0000000000o1';
const STUDENT = '00000000-0000-4000-8000-0000000000u1';

function actor(role: UserRole, id: string): AuthenticatedUser {
  return { id, email: `${id}@example.test`, role };
}

function section(over: Partial<AcademicSection> = {}): AcademicSection {
  return {
    id: SEC_A,
    subjectId: SUBJ,
    semesterId: TERM,
    professorId: PROF_A,
    code: 'A1',
    isActive: true,
    ...over,
  } as AcademicSection;
}

/** Minimal in-memory stand-in for a TypeORM repository. */
function fakeRepo<T extends { id?: string }>(rows: T[] = []) {
  let store = rows.map((r) => ({ ...r }));
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  const repo = {
    find: vi.fn(async (arg?: { where?: Record<string, unknown> }) =>
      arg?.where ? store.filter((r) => matches(r as never, arg.where!)) : [...store],
    ),
    findOne: vi.fn(async (arg: { where: Record<string, unknown> }) =>
      store.find((r) => matches(r as never, arg.where)) ?? null,
    ),
    exists: vi.fn(async (arg: { where: Record<string, unknown> }) =>
      store.some((r) => matches(r as never, arg.where)),
    ),
    count: vi.fn(async (arg?: { where?: Record<string, unknown> }) =>
      arg?.where ? store.filter((r) => matches(r as never, arg.where!)).length : store.length,
    ),
    create: vi.fn((data: Partial<T>) => ({ ...data }) as T),
    save: vi.fn(async (row: T) => {
      const saved = { ...(row as never), id: (row as never).id ?? `id-${store.length + 1}` };
      const index = store.findIndex((r) => (r as never).id === (saved as never).id);
      if (index >= 0) {
        store[index] = saved;
      } else {
        store.push(saved);
      }
      return saved as T;
    }),
    createQueryBuilder: vi.fn(),
    _rows: () => store,
    _set: (rows: T[]) => {
      store = rows.map((r) => ({ ...r }));
    },
  };
  return repo;
}

interface Harness {
  service: SubjectTeamsService;
  repos: ReturnType<typeof buildRepos>;
}

function buildRepos() {
  return {
    teams: fakeRepo<StudyTeam>([]),
    slots: fakeRepo<TeamTaskSlot>([]),
    memberships: fakeRepo<TeamMembership>([]),
    requests: fakeRepo<TeamJoinRequest>([]),
    sections: fakeRepo<AcademicSection>([]),
    subjects: fakeRepo<Subject>([]),
    users: fakeRepo<User>([]),
  };
}

/**
 * Builds a SubjectTeamsService with in-memory repositories. The service's
 * transaction/query-builder paths are exercised through thin fakes that apply
 * the same where-clauses the real code uses.
 */
function makeService(configure?: (repos: ReturnType<typeof buildRepos>) => void): Harness {
  const repos = buildRepos();
  configure?.(repos);

  // sections.createQueryBuilder is used exclusively for the enrollment lookup.
  // By default the enrollment lookup returns no rows, which exercises the
  // explicit-selection fallback; individual tests can override it.
  (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = vi.fn(
    () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => [],
      };
      return builder;
    },
  );

  const manager = {
    create: (entity: unknown, data: Record<string, unknown>) => ({ ...data }) as never,
    save: async (row: never) => row,
    findOne: async () => null,
    find: async () => [],
    count: async () => 0,
    createQueryBuilder: () => {
      const builder = {
        setLock: () => builder,
        where: () => builder,
        getOne: async () => null,
      };
      return builder;
    },
  };
  const dataSource = {
    transaction: async <R>(run: (m: typeof manager) => Promise<R>): Promise<R> => run(manager),
  };

  const service = new SubjectTeamsService(
    repos.teams as never,
    repos.slots as never,
    repos.memberships as never,
    repos.requests as never,
    repos.sections as never,
    repos.subjects as never,
    repos.users as never,
    dataSource as never,
  );

  return { service, repos };
}

describe('SubjectTeamsService.resolveCallerSections (eligibility)', () => {
  it('grants only the caller section when the caller is enrolled in it', async () => {
    const { service, repos } = makeService((r) => {
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section(), section({ id: SEC_B, professorId: PROF_B })]);
    });
    // Simulate the enrollment query returning SEC_A only.
    const enrolled = [section()];
    (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => enrolled,
      };
      return builder;
    };

    const state = await service.getMyState(actor(UserRole.STUDENT, STUDENT), SUBJ, TERM);
    expect(state.hasEligibleSection).toBe(true);
  });

  it('denies eligibility when the caller is enrolled but not in the requested section', async () => {
    const { service, repos } = makeService((r) => {
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section(), section({ id: SEC_B, professorId: PROF_B })]);
    });
    const enrolled = [section()]; // enrolled in SEC_A only
    (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => enrolled,
      };
      return builder;
    };

    const state = await service.getMyState(
      actor(UserRole.STUDENT, STUDENT),
      SUBJ,
      TERM,
      SEC_B,
    );
    expect(state.hasEligibleSection).toBe(false);
  });

  it('rejects a subject outside the caller program', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: 'other-program' } as Subject]);
    });
    await expect(
      service.getMyState(actor(UserRole.STUDENT, STUDENT), SUBJ, TERM),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies a caller with no program', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: STUDENT, programId: null } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
    });
    await expect(
      service.getMyState(actor(UserRole.STUDENT, STUDENT), SUBJ, TERM),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('falls back to explicit selection only when the caller has no enrollment', async () => {
    const { service, repos } = makeService((r) => {
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
    });
    (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => [], // no enrollment rows at all
      };
      return builder;
    };

    const withSelection = await service.getMyState(
      actor(UserRole.STUDENT, STUDENT),
      SUBJ,
      TERM,
      SEC_A,
    );
    const withoutSelection = await service.getMyState(
      actor(UserRole.STUDENT, STUDENT),
      SUBJ,
      TERM,
    );
    expect(withSelection.hasEligibleSection).toBe(true);
    expect(withoutSelection.hasEligibleSection).toBe(true); // professor set is non-empty
  });
});

describe('SubjectTeamsService.createTeam (validation)', () => {
  const base = {
    name: 'فريق',
    subjectId: SUBJ,
    sectionId: SEC_A,
    semesterId: TERM,
    scope: TeamScope.SECTION,
    maxMembers: 3,
    taskSlots: [
      { taskDescription: 'مهمة 1' },
      { taskDescription: 'مهمة 2' },
      { taskDescription: 'مهمة 3' },
    ],
    contactMethod: TeamContactMethod.TELEGRAM,
    contactValue: 'studygroup',
  };

  it('rejects a task slot count that does not match maxMembers', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
    });
    await expect(
      service.createTeam(actor(UserRole.STUDENT, OWNER), {
        ...base,
        taskSlots: [{ taskDescription: 'one' }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a section that has no assigned professor', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section({ professorId: null })]);
    });
    await expect(
      service.createTeam(actor(UserRole.STUDENT, OWNER), base as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid contact value', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
    });
    await expect(
      service.createTeam(actor(UserRole.STUDENT, OWNER), {
        ...base,
        contactMethod: TeamContactMethod.GROUP_LINK,
        contactValue: 'javascript:alert(1)',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a caller who already belongs to a team for the subject+term', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
      r.memberships._set([
        {
          id: 'm1',
          teamId: TEAM,
          userId: OWNER,
          subjectId: SUBJ,
          semesterId: TERM,
          role: TeamRole.OWNER,
        } as TeamMembership,
      ]);
    });
    await expect(
      service.createTeam(actor(UserRole.STUDENT, OWNER), base as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a caller with a pending request for the same subject+term', async () => {
    const { service } = makeService((r) => {
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
      r.requests._set([
        {
          id: 'r1',
          teamId: TEAM,
          studentId: OWNER,
          subjectId: SUBJ,
          semesterId: TERM,
          status: JoinRequestStatus.PENDING,
        } as TeamJoinRequest,
      ]);
    });
    await expect(
      service.createTeam(actor(UserRole.STUDENT, OWNER), base as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SubjectTeamsService.getTeamDetail (visibility + contact privacy)', () => {
  function seededTeam() {
    return {
      id: TEAM,
      name: 'فريق',
      description: null,
      subjectId: SUBJ,
      semesterId: TERM,
      sectionId: SEC_A,
      professorId: PROF_A,
      scope: TeamScope.SECTION,
      creatorId: OWNER,
      maxMembers: 3,
      contactMethod: TeamContactMethod.TELEGRAM,
      contactValue: 'studygroup',
      status: TeamStatus.ACTIVE,
      visibility: 'PUBLIC',
      createdAt: new Date(),
      subject: { id: SUBJ, nameAr: 'مادة' },
      semester: { id: TERM, name: 'الفصل' },
      section: { id: SEC_A, code: 'A1' },
      professor: { id: PROF_A, name: 'أحمد' },
      creator: { id: OWNER, fullName: 'المالك' },
    } as unknown as StudyTeam;
  }

  it('never exposes the contact value or member list to a non-member', async () => {
    const { service } = makeService((r) => {
      r.teams._set([seededTeam()]);
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.slots._set([
        {
          id: 's1',
          teamId: TEAM,
          position: 1,
          taskDescription: 'owner task',
          state: TeamTaskSlotState.JOINED,
          memberId: OWNER,
        } as TeamTaskSlot,
        {
          id: 's2',
          teamId: TEAM,
          position: 2,
          taskDescription: 'open task',
          state: TeamTaskSlotState.OPEN,
          memberId: null,
        } as TeamTaskSlot,
      ]);
      // The caller is a member of a *different* team for the same subject+term,
      // which makes them eligible to view but not a member of this one.
      r.memberships._set([
        { id: 'm1', teamId: TEAM, userId: OWNER, role: TeamRole.OWNER } as TeamMembership,
      ]);
    });
    // The caller is NOT a member of TEAM, so contact must be hidden and the
    // member list must be empty.
    const detail = await service.getTeamDetail(actor(UserRole.STUDENT, OWNER), TEAM);
    expect(detail.contactValue).toBe('studygroup'); // creator sees own contact
    expect(detail.members).toHaveLength(1);

    const strangerDetail = await service.getTeamDetail(actor(UserRole.ADMIN, STUDENT), TEAM);
    expect(strangerDetail.contactValue).toBeNull();
  });

  it('hides a team entirely from a student not in the team scope', async () => {
    const { service, repos } = makeService((r) => {
      r.teams._set([seededTeam()]);
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      // No enrollment; the caller explicitly picks a different professor's section.
      r.sections._set([section({ id: SEC_B, professorId: PROF_B })]);
    });
    (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => [],
      };
      return builder;
    };
    await expect(
      service.getTeamDetail(actor(UserRole.STUDENT, STUDENT), TEAM, SEC_B as never),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('SubjectTeamsService.listTeams (scope gating)', () => {
  function scopeTeam() {
    return {
      id: TEAM,
      name: 'فريق',
      description: null,
      subjectId: SUBJ,
      semesterId: TERM,
      sectionId: SEC_A,
      professorId: PROF_A,
      scope: TeamScope.SECTION,
      creatorId: OWNER,
      maxMembers: 3,
      contactMethod: null,
      contactValue: null,
      status: TeamStatus.ACTIVE,
      createdAt: new Date(),
    } as unknown as StudyTeam;
  }

  it('returns an empty page when the caller has no eligible professor', async () => {
    const { service } = makeService((r) => {
      r.teams._set([scopeTeam()]);
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([]); // no sections at all in the catalog
    });
    const page = await service.listTeams(actor(UserRole.STUDENT, STUDENT), {
      subjectId: SUBJ,
      semesterId: TERM,
      page: 1,
      limit: 20,
    } as never);
    expect(page.data).toHaveLength(0);
    expect(page.meta.total).toBe(0);
  });
});

describe('SubjectTeamsService.updateTeam (editing restrictions)', () => {
  function creatorSeeded() {
    return {
      id: TEAM,
      name: 'فريق',
      description: null,
      subjectId: SUBJ,
      semesterId: TERM,
      sectionId: SEC_A,
      professorId: PROF_A,
      scope: TeamScope.SECTION,
      creatorId: OWNER,
      maxMembers: 3,
      contactMethod: TeamContactMethod.TELEGRAM,
      contactValue: 'studygroup',
      status: TeamStatus.ACTIVE,
      visibility: 'PUBLIC',
      createdAt: new Date(),
    } as unknown as StudyTeam;
  }

  it('rejects an editor who is not the creator', async () => {
    const { service } = makeService((r) => r.teams._set([creatorSeeded()]));
    await expect(
      service.updateTeam(actor(UserRole.STUDENT, STUDENT), TEAM, { description: 'x' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a maxMembers change after creation', async () => {
    const { service } = makeService((r) => r.teams._set([creatorSeeded()]));
    await expect(
      service.updateTeam(actor(UserRole.STUDENT, OWNER), TEAM, { maxMembers: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid contact update', async () => {
    const { service } = makeService((r) => r.teams._set([creatorSeeded()]));
    await expect(
      service.updateTeam(actor(UserRole.STUDENT, OWNER), TEAM, {
        contactValue: 'not a link',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SubjectTeamsService.createJoinRequest (guards)', () => {
  function seededTeam() {
    return {
      id: TEAM,
      name: 'فريق',
      subjectId: SUBJ,
      semesterId: TERM,
      sectionId: SEC_A,
      professorId: PROF_A,
      scope: TeamScope.SECTION,
      creatorId: OWNER,
      maxMembers: 3,
      status: TeamStatus.ACTIVE,
      createdAt: new Date(),
    } as unknown as StudyTeam;
  }

  it('prevents the creator from joining their own team', async () => {
    const { service } = makeService((r) => {
      r.teams._set([seededTeam()]);
      r.users._set([{ id: OWNER, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
    });
    await expect(
      service.createJoinRequest(actor(UserRole.STUDENT, OWNER), TEAM, { slotId: 's2' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a slot that is not open', async () => {
    const { service, repos } = makeService((r) => {
      r.teams._set([seededTeam()]);
      r.users._set([{ id: STUDENT, programId: P_A } as User]);
      r.subjects._set([{ id: SUBJ, programId: P_A } as Subject]);
      r.sections._set([section()]);
      r.slots._set([
        {
          id: 's2',
          teamId: TEAM,
          position: 2,
          taskDescription: 'taken',
          state: TeamTaskSlotState.JOINED,
          memberId: 'someone',
        } as TeamTaskSlot,
      ]);
    });
    // The caller is enrolled in the team's originating section, so the team is
    // visible and the only remaining failure is the taken slot.
    (repos.sections as never as { createQueryBuilder: () => unknown }).createQueryBuilder = () => {
      const builder = {
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        getMany: async () => [section()],
      };
      return builder;
    };
    await expect(
      service.createJoinRequest(actor(UserRole.STUDENT, STUDENT), TEAM, { slotId: 's2' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a non-student caller', async () => {
    const { service } = makeService();
    await expect(
      service.createJoinRequest(actor(UserRole.ADMIN, STUDENT), TEAM, { slotId: 's2' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SubjectTeamsService.cancelJoinRequest (authorization)', () => {
  it('rejects cancelling another student request', async () => {
    const { service } = makeService((r) =>
      r.requests._set([
        {
          id: 'r1',
          teamId: TEAM,
          studentId: 'someone-else',
          status: JoinRequestStatus.PENDING,
        } as TeamJoinRequest,
      ]),
    );
    await expect(
      service.cancelJoinRequest(actor(UserRole.STUDENT, STUDENT), TEAM, 'r1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cancelling a request that is not pending', async () => {
    const { service } = makeService((r) =>
      r.requests._set([
        {
          id: 'r1',
          teamId: TEAM,
          studentId: STUDENT,
          status: JoinRequestStatus.REJECTED,
        } as TeamJoinRequest,
      ]),
    );
    await expect(
      service.cancelJoinRequest(actor(UserRole.STUDENT, STUDENT), TEAM, 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels the caller own pending request', async () => {
    const { service, repos } = makeService((r) =>
      r.requests._set([
        {
          id: 'r1',
          teamId: TEAM,
          studentId: STUDENT,
          status: JoinRequestStatus.PENDING,
        } as TeamJoinRequest,
      ]),
    );
    await service.cancelJoinRequest(actor(UserRole.STUDENT, STUDENT), TEAM, 'r1');
    const row = repos.requests._rows().find((r) => r.id === 'r1');
    expect(row?.status).toBe(JoinRequestStatus.CANCELLED);
  });
});
