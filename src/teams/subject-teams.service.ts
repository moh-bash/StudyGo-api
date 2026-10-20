import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import {
  EnrollmentStatus,
  JoinRequestStatus,
  TeamContactMethod,
  TeamRole,
  TeamScope,
  TeamStatus,
  TeamTaskSlotState,
  UserRole,
} from '../common/enums.js';import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateSubjectJoinRequestDto } from './dto/create-subject-join-request.dto.js';
import { CreateTeamDto } from './dto/create-subject-team.dto.js';
import { QuerySubjectTeamsDto } from './dto/query-subject-teams.dto.js';
import { UpdateSubjectTeamDto } from './dto/update-subject-team.dto.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';
import { TeamTaskSlot } from './entities/team-task-slot.entity.js';
import { validateContact } from './team-contact.util.js';

/** A team row enriched with the derived facts the UI needs, without N+1. */
export interface SubjectTeamView {
  id: string;
  name: string;
  description: string | null;
  subjectId: string | null;
  subjectNameAr: string | null;
  semesterId: string | null;
  semesterName: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  professorId: string | null;
  professorName: string | null;
  scope: TeamScope;
  creatorId: string;
  creatorName: string;
  maxMembers: number;
  memberCount: number;
  openSlotCount: number;
  contactMethod: TeamContactMethod | null;
  /** Only present when the caller is allowed to see it (member/creator). */
  contactValue: string | null;
  createdAt: Date;
}

/** Full detail of a team, including its task slots and (permitted) members. */
export interface SubjectTeamDetail extends SubjectTeamView {
  slots: Array<{
    id: string;
    position: number;
    taskDescription: string;
    state: TeamTaskSlotState;
    memberId: string | null;
    memberName: string | null;
    /** Id of the pending request for this slot, when the caller may see it. */
    pendingRequestStudentId: string | null;
  }>;
  members: Array<{ userId: string; fullName: string; role: TeamRole; slotId: string | null }>;
  /** The caller's own relationship to this team. */
  viewer: {
    isCreator: boolean;
    isMember: boolean;
    membershipSlotId: string | null;
    pendingRequestSlotId: string | null;
    pendingRequestId: string | null;
  };
}

/** The caller's own subject/term team state (own team, membership, request). */
export interface MySubjectTeamState {
  team: SubjectTeamView | null;
  membershipSlotId: string | null;
  pendingRequest: { id: string; slotId: string | null; status: JoinRequestStatus } | null;
  /** True when the caller currently has a valid section for this subject+term. */
  hasEligibleSection: boolean;
}

export interface CreatorJoinRequestView {
  id: string;
  status: JoinRequestStatus;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  studentId: string;
  studentName: string;
  slotId: string | null;
  slotPosition: number | null;
  taskDescription: string | null;
}

/**
 * Phase 5 subject-team service.
 *
 * Owns team creation, eligibility/visibility, task slots, the in-app join
 * request workflow, membership, and editing — all enforced server-side from the
 * authenticated caller. The student's section for a subject+term is supplied by
 * the client (it is not derivable from the server) but is always re-validated
 * here against the real section/subject/term/professor catalog and the caller's
 * own academic program; nothing sensitive is ever inferred from a display name.
 */
@Injectable()
export class SubjectTeamsService {
  constructor(
    @InjectRepository(StudyTeam) private readonly teams: Repository<StudyTeam>,
    @InjectRepository(TeamTaskSlot) private readonly slots: Repository<TeamTaskSlot>,
    @InjectRepository(TeamMembership) private readonly memberships: Repository<TeamMembership>,
    @InjectRepository(TeamJoinRequest) private readonly requests: Repository<TeamJoinRequest>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Eligibility helpers
  // ---------------------------------------------------------------------------

  /** Validates a section belongs to the subject+term and is active. */
  private async assertSectionForSubjectTerm(
    subjectId: string,
    semesterId: string,
    sectionId?: string,
  ): Promise<AcademicSection> {
    const section = sectionId
      ? await this.sections.findOne({ where: { id: sectionId } })
      : null;
    if (!section) {
      throw new BadRequestException('Section not found');
    }
    if (!section.isActive) {
      throw new BadRequestException('Section is not active');
    }
    if (section.subjectId !== subjectId || section.semesterId !== semesterId) {
      throw new BadRequestException('Section does not belong to this subject and term');
    }
    return section;
  }

  private async assertCallerProgram(actor: AuthenticatedUser, subjectId: string): Promise<void> {
    const [user, subject] = await Promise.all([
      this.users.findOne({ where: { id: actor.id } }),
      this.subjects.findOne({ where: { id: subjectId } }),
    ]);
    if (!user || !subject) {
      throw new BadRequestException('Unknown student or subject');
    }
    if (
      user.programId === null ||
      subject.programId === null ||
      user.programId !== subject.programId
    ) {
      throw new ForbiddenException('This subject is not part of your academic program');
    }
  }

  /**
   * Resolves the caller's sections for a subject+term, or `null` when the
   * caller has no usable section for it.
   *
   * The academic enrollment table (`student_enrollments`) is the source of
   * truth whenever it has rows for the caller in this term — both for the
   * caller's professor/section set and for section selection. Local-only
   * planning data never widens access beyond a real enrollment. Only while no
   * enrollment exists for the caller in the term (a partially populated
   * catalog, as in the current deployment) does the flow fall back to the
   * explicit section the app supplies, which is still re-validated against the
   * real section/subject/term/professor catalog and the caller's program.
   */
  private async resolveCallerSections(
    actor: AuthenticatedUser,
    subjectId: string,
    semesterId: string,
    sectionId?: string,
  ): Promise<{ professorIds: string[]; sectionIds: string[] } | null> {
    const enrolled = await this.sections
      .createQueryBuilder('section')
      .innerJoin(
        'student_enrollments',
        'enrollment',
        'enrollment."sectionId" = section.id AND enrollment."studentId" = :studentId AND enrollment.status = :enrolledStatus',
        { studentId: actor.id, enrolledStatus: EnrollmentStatus.ENROLLED },
      )
      .where('section.subjectId = :subjectId', { subjectId })
      .andWhere('section.semesterId = :semesterId', { semesterId })
      .andWhere('section.isActive = true')
      .orderBy('section.code', 'ASC')
      .getMany();

    if (enrolled.length > 0) {
      const usable = sectionId ? enrolled.filter((s) => s.id === sectionId) : enrolled;
      if (usable.length === 0) {
        // Enrolled, but not in the requested section: never fall through to the
        // planning fallback, or a stale local pick would grant access.
        return null;
      }
      return {
        professorIds: [
          ...new Set(usable.map((s) => s.professorId).filter((id): id is string => id !== null)),
        ],
        sectionIds: usable.map((s) => s.id),
      };
    }

    // No enrollment at all this term for this subject: explicit selection flow.
    const offered = await this.sections.find({
      where: { subjectId, semesterId, isActive: true },
    });
    if (sectionId) {
      const selected = offered.find((s) => s.id === sectionId);
      if (selected && selected.professorId !== null) {
        return { professorIds: [selected.professorId], sectionIds: [selected.id] };
      }
      return null;
    }
    // With no explicit selection the fallback exposes only the professor set,
    // never a concrete section (there is nothing the caller has "chosen").
    return {
      professorIds: [
        ...new Set(offered.map((s) => s.professorId).filter((id): id is string => id !== null)),
      ],
      sectionIds: [],
    };
  }

  /** True when the caller may act as a student of this subject+term. */
  private async hasSection(
    actor: AuthenticatedUser,
    subjectId: string,
    semesterId: string,
    sectionId?: string,
  ): Promise<boolean> {
    const resolved = await this.resolveCallerSections(actor, subjectId, semesterId, sectionId);
    return resolved !== null && resolved.professorIds.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async createTeam(actor: AuthenticatedUser, dto: CreateTeamDto): Promise<SubjectTeamDetail> {
    await this.assertCallerProgram(actor, dto.subjectId);
    const section = await this.assertSectionForSubjectTerm(
      dto.subjectId,
      dto.semesterId,
      dto.sectionId,
    );
    if (section.professorId === null) {
      throw new BadRequestException('The selected section has no assigned professor');
    }
    if (dto.taskSlots.length !== dto.maxMembers) {
      throw new BadRequestException(
        `Exactly ${dto.maxMembers} task slots are required (one per member, including you)`,
      );
    }

    const contact = validateContact(dto.contactMethod, dto.contactValue);
    if (!contact.ok) {
      throw new BadRequestException(contact.error);
    }

    // The caller must not already be committed to a team for this subject+term.
    await this.assertNoCommitment(actor.id, dto.subjectId, dto.semesterId);

    try {
      const teamId = await this.dataSource.transaction(async (manager) => {
        const team = manager.create(StudyTeam, {
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          subjectId: dto.subjectId,
          sectionId: section.id,
          semesterId: dto.semesterId,
          professorId: section.professorId,
          scope: dto.scope,
          creatorId: actor.id,
          maxMembers: dto.maxMembers,
          contactMethod: dto.contactMethod,
          contactValue: contact.value ?? null,
          status: TeamStatus.ACTIVE,
        });
        const saved = await manager.save(team);

        // Slots: position 1 is the creator's slot.
        const slotRows = dto.taskSlots.map((slot, index) =>
          manager.create(TeamTaskSlot, {
            teamId: saved.id,
            position: index + 1,
            taskDescription: slot.taskDescription.trim(),
            state: index === 0 ? TeamTaskSlotState.JOINED : TeamTaskSlotState.OPEN,
            memberId: index === 0 ? actor.id : null,
          }),
        );
        const savedSlots = await manager.save(slotRows);

        const membership = manager.create(TeamMembership, {
          teamId: saved.id,
          userId: actor.id,
          role: TeamRole.OWNER,
          slotId: savedSlots[0]?.id ?? null,
          subjectId: dto.subjectId,
          semesterId: dto.semesterId,
        });
        await manager.save(membership);
        return saved.id;
      });

      return this.getTeamDetail(actor, teamId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('You already belong to a team for this subject and term');
      }
      throw error;
    }
  }

  private async assertNoCommitment(
    userId: string,
    subjectId: string,
    semesterId: string,
  ): Promise<void> {
    const membership = await this.memberships.findOne({
      where: { userId, subjectId, semesterId },
    });
    if (membership) {
      throw new ConflictException('You already belong to a team for this subject and term');
    }
    const pending = await this.requests.findOne({
      where: { studentId: userId, subjectId, semesterId, status: JoinRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a pending join request for this subject and term',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Visibility + listing
  // ---------------------------------------------------------------------------

  /**
   * Eligible professor/section ids for the caller: derived from the caller's
   * real enrollments for the subject+term (falling back to the explicit
   * selection flow only when the caller has no enrollment at all). A student
   * with no usable section gets an empty set and therefore sees no teams.
   */
  private async callerProfessorIds(
    actor: AuthenticatedUser,
    subjectId: string,
    semesterId: string,
    sectionId?: string,
  ): Promise<{ professorIds: string[]; sectionIds: string[] }> {
    await this.assertCallerProgram(actor, subjectId);
    const resolved = await this.resolveCallerSections(actor, subjectId, semesterId, sectionId);
    return resolved ?? { professorIds: [], sectionIds: [] };
  }

  async listTeams(
    actor: AuthenticatedUser,
    query: QuerySubjectTeamsDto,
    sectionId?: string,
  ): Promise<PaginatedResult<SubjectTeamView>> {
    const { professorIds, sectionIds } = await this.callerProfessorIds(
      actor,
      query.subjectId,
      query.semesterId,
      sectionId,
    );
    if (professorIds.length === 0) {
      return buildPaginatedResult<SubjectTeamView>([], 0, query.page, query.limit);
    }

    // Visibility: same subject + term + professor, and the caller's section must
    // satisfy the team's scope. SECTION-scope teams require the caller to be in
    // the originating section; PROFESSOR-scope teams require the same professor.
    const qb = this.teams
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.subject', 'subject')
      .leftJoinAndSelect('team.semester', 'semester')
      .leftJoinAndSelect('team.section', 'section')
      .leftJoinAndSelect('team.professor', 'professor')
      .leftJoinAndSelect('team.creator', 'creator')
      .where('team.subjectId = :subjectId', { subjectId: query.subjectId })
      .andWhere('team.semesterId = :semesterId', { semesterId: query.semesterId })
      .andWhere('team.professorId IN (:...professorIds)', { professorIds })
      .andWhere('team.status = :status', { status: TeamStatus.ACTIVE });

    if (query.scope) {
      qb.andWhere('team.scope = :scope', { scope: query.scope });
    }
    if (query.search) {
      qb.andWhere('team.name ILIKE :search', { search: `%${query.search}%` });
    }

    // Scope gate: keep only teams whose scope the caller's sections satisfy.
    const scopeClause = `(team.scope = :profScope OR (team.scope = :secScope AND team.sectionId IN (:...callerSectionIds)))`;
    qb.andWhere(scopeClause, {
      profScope: TeamScope.PROFESSOR,
      secScope: TeamScope.SECTION,
      callerSectionIds: sectionIds.length > 0 ? sectionIds : ['00000000-0000-0000-0000-000000000000'],
    });

    qb.orderBy('team.createdAt', 'DESC')
      .skip(getSkip(query.page, query.limit))
      .take(query.limit);

    const [teams, total] = await qb.getManyAndCount();
    const views = await this.buildTeamViews(actor, teams);
    return buildPaginatedResult(views, total, query.page, query.limit);
  }

  /** Enriches team rows with counts and (permitted) contact visibility. */
  private async buildTeamViews(
    actor: AuthenticatedUser,
    teams: StudyTeam[],
  ): Promise<SubjectTeamView[]> {
    if (teams.length === 0) {
      return [];
    }
    const teamIds = teams.map((t) => t.id);
    const [memberships, slots] = await Promise.all([
      this.memberships.find({ where: { teamId: In(teamIds) } }),
      this.slots.find({ where: { teamId: In(teamIds) } }),
    ]);
    const memberCountByTeam = new Map<string, number>();
    const openCountByTeam = new Map<string, number>();
    const viewerIsMember = new Set<string>();
    for (const m of memberships) {
      memberCountByTeam.set(m.teamId, (memberCountByTeam.get(m.teamId) ?? 0) + 1);
      if (m.userId === actor.id) {
        viewerIsMember.add(m.teamId);
      }
    }
    for (const s of slots) {
      if (s.state === TeamTaskSlotState.OPEN) {
        openCountByTeam.set(s.teamId, (openCountByTeam.get(s.teamId) ?? 0) + 1);
      }
    }

    return teams.map((team) => {
      const viewerIsCreator = team.creatorId === actor.id;
      const maySeeContact = viewerIsCreator || viewerIsMember.has(team.id);
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        subjectId: team.subjectId,
        subjectNameAr: team.subject?.nameAr ?? null,
        semesterId: team.semesterId,
        semesterName: team.semester?.name ?? team.semester?.code ?? null,
        sectionId: team.sectionId,
        sectionCode: team.section?.code ?? null,
        professorId: team.professorId,
        professorName: team.professor?.name ?? null,
        scope: team.scope,
        creatorId: team.creatorId,
        creatorName: team.creator?.fullName ?? '',
        maxMembers: team.maxMembers,
        memberCount: memberCountByTeam.get(team.id) ?? 0,
        openSlotCount: openCountByTeam.get(team.id) ?? 0,
        contactMethod: team.contactMethod,
        // Contact details are shown only to the creator and accepted members;
        // an ineligible/discovering student never receives them.
        contactValue: maySeeContact ? team.contactValue : null,
        createdAt: team.createdAt,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async getTeamDetail(actor: AuthenticatedUser, teamId: string): Promise<SubjectTeamDetail> {
    const team = await this.teams.findOne({
      where: { id: teamId },
      relations: { subject: true, semester: true, section: true, professor: true, creator: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertVisible(actor, team);

    const [slots, memberships, pendingRequests] = await Promise.all([
      this.slots.find({ where: { teamId }, order: { position: 'ASC' } }),
      this.memberships.find({ where: { teamId }, relations: { user: true } }),
      this.requests.find({ where: { teamId, status: JoinRequestStatus.PENDING } }),
    ]);

    const isCreator = team.creatorId === actor.id;
    const ownMembership = memberships.find((m) => m.userId === actor.id) ?? null;
    const ownPending = pendingRequests.find((r) => r.studentId === actor.id) ?? null;
    const viewerMembershipIds = new Set(memberships.map((m) => m.userId));
    const pendingBySlot = new Map<string, TeamJoinRequest>();
    for (const r of pendingRequests) {
      if (r.slotId) {
        pendingBySlot.set(r.slotId, r);
      }
    }

    const memberNameById = new Map(memberships.map((m) => [m.userId, m.user?.fullName ?? '']));

    const base = (await this.buildTeamViews(actor, [team]))[0];

    return {
      ...base,
      slots: slots.map((slot) => {
        const pending = pendingBySlot.get(slot.id);
        return {
          id: slot.id,
          position: slot.position,
          taskDescription: slot.taskDescription,
          state: slot.state,
          memberId: slot.memberId,
          memberName: slot.memberId ? memberNameById.get(slot.memberId) ?? null : null,
          // Only the creator sees who is waiting on each slot.
          pendingRequestStudentId: isCreator && pending ? pending.studentId : null,
        };
      }),
      // Member identities are shown only to the creator, accepted members, and
      // admins — never to an unrelated discovering student.
      members:
        isCreator || viewerMembershipIds.has(actor.id) || actor.role === UserRole.ADMIN
          ? memberships.map((m) => ({
              userId: m.userId,
              fullName: m.user?.fullName ?? '',
              role: m.role,
              slotId: m.slotId,
            }))
          : [],
      viewer: {
        isCreator,
        isMember: ownMembership !== null,
        membershipSlotId: ownMembership?.slotId ?? null,
        pendingRequestSlotId: ownPending?.slotId ?? null,
        pendingRequestId: ownPending?.id ?? null,
      },
    };
  }

  /** Enforces the same visibility rules as the list endpoint, for one team. */
  private async assertVisible(actor: AuthenticatedUser, team: StudyTeam): Promise<void> {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (team.creatorId === actor.id) {
      return;
    }
    const isMember = await this.memberships.exists({ where: { teamId: team.id, userId: actor.id } });
    if (isMember) {
      return;
    }
    if (team.subjectId === null || team.semesterId === null || team.professorId === null) {
      throw new NotFoundException('Team not found');
    }
    const { professorIds, sectionIds } = await this.callerProfessorIds(
      actor,
      team.subjectId,
      team.semesterId,
    );
    const sameProfessor = professorIds.includes(team.professorId);
    const scopeSatisfied =
      team.scope === TeamScope.PROFESSOR ||
      (team.scope === TeamScope.SECTION && team.sectionId !== null && sectionIds.includes(team.sectionId));
    if (!sameProfessor || !scopeSatisfied) {
      // Non-disclosure: an ineligible student must not learn the team exists.
      throw new NotFoundException('Team not found');
    }
  }

  // ---------------------------------------------------------------------------
  // My state
  // ---------------------------------------------------------------------------

  async getMyState(
    actor: AuthenticatedUser,
    subjectId: string,
    semesterId: string,
    sectionId?: string,
  ): Promise<MySubjectTeamState> {
    await this.assertCallerProgram(actor, subjectId);
    const membership = await this.memberships.findOne({
      where: { userId: actor.id, subjectId, semesterId },
    });
    const pending = await this.requests.findOne({
      where: { studentId: actor.id, subjectId, semesterId, status: JoinRequestStatus.PENDING },
    });

    let team: SubjectTeamView | null = null;
    if (membership) {
      const row = await this.teams.findOne({
        where: { id: membership.teamId },
        relations: { subject: true, semester: true, section: true, professor: true, creator: true },
      });
      if (row) {
        team = (await this.buildTeamViews(actor, [row]))[0];
      }
    } else if (pending) {
      const row = await this.teams.findOne({
        where: { id: pending.teamId },
        relations: { subject: true, semester: true, section: true, professor: true, creator: true },
      });
      if (row) {
        team = (await this.buildTeamViews(actor, [row]))[0];
      }
    }

    const hasEligibleSection = await this.hasSection(actor, subjectId, semesterId, sectionId);

    return {
      team,
      membershipSlotId: membership?.slotId ?? null,
      pendingRequest: pending
        ? { id: pending.id, slotId: pending.slotId, status: pending.status }
        : null,
      hasEligibleSection,
    };
  }

  // ---------------------------------------------------------------------------
  // Join requests
  // ---------------------------------------------------------------------------

  async createJoinRequest(
    actor: AuthenticatedUser,
    teamId: string,
    dto: CreateSubjectJoinRequestDto,
  ): Promise<CreatorJoinRequestView> {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can request to join a team');
    }
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.status !== TeamStatus.ACTIVE) {
      throw new BadRequestException('This team is not accepting join requests');
    }
    if (team.creatorId === actor.id) {
      throw new BadRequestException('You cannot request to join your own team');
    }
    if (team.subjectId === null || team.semesterId === null || team.professorId === null) {
      throw new BadRequestException('This team is not a subject team');
    }
    await this.assertVisible(actor, team);
    const isMember = await this.memberships.exists({ where: { teamId, userId: actor.id } });
    if (isMember) {
      throw new BadRequestException('You are already a member of this team');
    }

    const slot = await this.slots.findOne({ where: { id: dto.slotId, teamId } });
    if (!slot) {
      throw new BadRequestException('The requested task slot does not belong to this team');
    }
    if (slot.state !== TeamTaskSlotState.OPEN || slot.memberId !== null) {
      throw new ConflictException('This task slot is no longer available');
    }

    // Capacity: member count must stay below maxMembers to accept a new request.
    const memberCount = await this.memberships.count({ where: { teamId } });
    if (memberCount >= team.maxMembers) {
      throw new ConflictException('This team is full');
    }

    await this.assertNoCommitment(actor.id, team.subjectId, team.semesterId);

    try {
      const saved = await this.requests.save(
        this.requests.create({
          teamId,
          studentId: actor.id,
          slotId: slot.id,
          subjectId: team.subjectId,
          semesterId: team.semesterId,
          message: dto.message?.trim() ?? null,
          status: JoinRequestStatus.PENDING,
        }),
      );
      return this.toCreatorView(saved, slot, actor.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'You already have a pending request for this subject and term',
        );
      }
      throw error;
    }
  }

  private toCreatorView(
    request: TeamJoinRequest,
    slot: TeamTaskSlot | null,
    studentName: string,
  ): CreatorJoinRequestView {
    return {
      id: request.id,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
      studentId: request.studentId,
      studentName,
      slotId: request.slotId,
      slotPosition: slot?.position ?? null,
      taskDescription: slot?.taskDescription ?? null,
    };
  }

  async listCreatorRequests(
    actor: AuthenticatedUser,
    teamId: string,
    status?: JoinRequestStatus,
  ): Promise<CreatorJoinRequestView[]> {
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    this.assertCreator(team, actor);
    const qb = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.student', 'student')
      .leftJoinAndSelect('request.slot', 'slot')
      .where('request.teamId = :teamId', { teamId })
      .orderBy('request.createdAt', 'DESC');
    if (status) {
      qb.andWhere('request.status = :status', { status });
    }
    const rows = await qb.getMany();
    return rows.map((r) => this.toCreatorView(r, r.slot ?? null, r.student?.fullName ?? ''));
  }

  /**
   * Accept or reject a join request (creator only).
   *
   * Acceptance is atomic and concurrency-safe: inside a single transaction the
   * team row is locked (`pessimistic_write`), then the request, slot, capacity
   * and one-team restriction are all re-validated against the locked state. The
   * partial-unique indexes on memberships are the final backstop.
   */
  async decideJoinRequest(
    actor: AuthenticatedUser,
    teamId: string,
    requestId: string,
    approve: boolean,
  ): Promise<CreatorJoinRequestView> {
    return this.dataSource.transaction(async (manager) => {
      const team = await manager
        .createQueryBuilder(StudyTeam, 'team')
        .setLock('pessimistic_write')
        .where('team.id = :teamId', { teamId })
        .getOne();
      if (!team) {
        throw new NotFoundException('Team not found');
      }
      this.assertCreator(team, actor);

      const request = await manager.findOne(TeamJoinRequest, {
        where: { id: requestId, teamId },
        relations: { student: true },
      });
      if (!request) {
        throw new NotFoundException('Join request not found');
      }
      if (request.status !== JoinRequestStatus.PENDING) {
        throw new BadRequestException('This join request has already been decided');
      }

      if (!approve) {
        request.status = JoinRequestStatus.REJECTED;
        request.reviewedById = actor.id;
        request.decidedAt = new Date();
        const saved = await manager.save(request);
        return this.toCreatorView(saved, null, request.student?.fullName ?? '');
      }

      // --- Acceptance ---
      if (team.subjectId === null || team.semesterId === null) {
        throw new BadRequestException('This team is not a subject team');
      }
      if (request.slotId === null) {
        throw new BadRequestException('This request has no task slot');
      }
      const slot = await manager
        .createQueryBuilder(TeamTaskSlot, 'slot')
        .setLock('pessimistic_write')
        .where('slot.id = :slotId AND slot.teamId = :teamId', { slotId: request.slotId, teamId })
        .getOne();
      if (!slot) {
        throw new BadRequestException('The requested task slot no longer exists');
      }
      if (slot.state !== TeamTaskSlotState.OPEN || slot.memberId !== null) {
        throw new ConflictException('This task slot has already been taken');
      }

      const memberCount = await manager.count(TeamMembership, { where: { teamId } });
      if (memberCount >= team.maxMembers) {
        throw new ConflictException('The team is full');
      }

      // One-team-per-subject/term, re-checked inside the locked transaction.
      const alreadyInSubject = await manager.findOne(TeamMembership, {
        where: {
          userId: request.studentId,
          subjectId: team.subjectId,
          semesterId: team.semesterId,
        },
      });
      if (alreadyInSubject) {
        throw new ConflictException(
          'This student already belongs to a team for this subject and term',
        );
      }

      slot.state = TeamTaskSlotState.JOINED;
      slot.memberId = request.studentId;
      await manager.save(slot);

      try {
        await manager.save(
          manager.create(TeamMembership, {
            teamId,
            userId: request.studentId,
            role: TeamRole.MEMBER,
            slotId: slot.id,
            subjectId: team.subjectId,
            semesterId: team.semesterId,
          }),
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException('This student already belongs to a team for this subject and term');
        }
        throw error;
      }

      request.status = JoinRequestStatus.APPROVED;
      request.reviewedById = actor.id;
      request.decidedAt = new Date();
      const saved = await manager.save(request);
      return this.toCreatorView(saved, slot, request.student?.fullName ?? '');
    });
  }

  async cancelJoinRequest(
    actor: AuthenticatedUser,
    teamId: string,
    requestId: string,
  ): Promise<void> {
    const request = await this.requests.findOne({ where: { id: requestId, teamId } });
    if (!request) {
      throw new NotFoundException('Join request not found');
    }
    if (actor.role !== UserRole.ADMIN && request.studentId !== actor.id) {
      throw new ForbiddenException('You can only cancel your own join requests');
    }
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    request.status = JoinRequestStatus.CANCELLED;
    request.decidedAt = new Date();
    await this.requests.save(request);
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  async updateTeam(
    actor: AuthenticatedUser,
    teamId: string,
    dto: UpdateSubjectTeamDto,
  ): Promise<SubjectTeamDetail> {
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    this.assertCreator(team, actor);

    const memberCount = await this.memberships.count({ where: { teamId } });
    // Accepted members, plus every pending request that is already reserving a
    // slot (a pending reservation must be honored, so capacity may never drop
    // below it). Today the team size is immutable after creation, so this is a
    // defensive invariant rather than a reachable validation.
    const pendingCount = await this.requests.count({
      where: { teamId, status: JoinRequestStatus.PENDING },
    });

    if (dto.description !== undefined) {
      team.description = dto.description.trim();
    }
    if (dto.maxMembers !== undefined) {
      if (dto.maxMembers !== team.maxMembers) {
        throw new BadRequestException(
          'Team size cannot be changed after creation; the number of task slots is fixed',
        );
      }
      if (dto.maxMembers < memberCount + pendingCount) {
        // Unreachable today (size is immutable) but kept as a guard so a future
        // capacity change can never drop below accepted members + reservations.
        throw new BadRequestException(
          `maxMembers cannot be lower than the ${memberCount + pendingCount} members and reserved slots`,
        );
      }
    }
    if (dto.contactMethod !== undefined || dto.contactValue !== undefined) {
      const method = dto.contactMethod ?? team.contactMethod;
      const rawValue = dto.contactValue ?? team.contactValue;
      if (method === null || rawValue === null) {
        throw new BadRequestException('A contact method and value are required');
      }
      const validated = validateContact(method, rawValue);
      if (!validated.ok) {
        throw new BadRequestException(validated.error);
      }
      team.contactMethod = method;
      team.contactValue = validated.value ?? null;
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.taskSlots !== undefined) {
        await this.applySlotEdits(manager, teamId, dto.taskSlots);
      }
      await manager.save(team);
    });

    return this.getTeamDetail(actor, teamId);
  }

  /**
   * Applies task-slot text edits. Slot count must equal `maxMembers`; a slot
   * occupied by a member, or one with a pending request, cannot be edited or
   * removed (its text is a commitment to that member/requester).
   */
  private async applySlotEdits(
    manager: EntityManager,
    teamId: string,
    edits: Array<{ id?: string; taskDescription: string }>,
  ): Promise<void> {
    const existing = await manager.find(TeamTaskSlot, {
      where: { teamId },
      order: { position: 'ASC' },
    });
    if (edits.length !== existing.length) {
      throw new BadRequestException(
        'Task slots cannot be added or removed after creation',
      );
    }
    const pending = await manager.find(TeamJoinRequest, {
      where: { teamId, status: JoinRequestStatus.PENDING },
    });
    const reservedSlotIds = new Set(pending.map((r) => r.slotId).filter((id): id is string => !!id));
    const existingById = new Map(existing.map((s) => [s.id, s]));

    const seen = new Set<string>();
    for (const edit of edits) {
      if (!edit.id || !existingById.has(edit.id)) {
        throw new BadRequestException('Task slot ids must reference existing slots of this team');
      }
      if (seen.has(edit.id)) {
        throw new BadRequestException('Duplicate task slot id');
      }
      seen.add(edit.id);
      const slot = existingById.get(edit.id)!;
      const text = edit.taskDescription.trim();
      if (text === slot.taskDescription) {
        continue;
      }
      if (slot.memberId !== null || slot.state === TeamTaskSlotState.JOINED) {
        throw new BadRequestException(
          'A joined member’s task cannot be changed after acceptance',
        );
      }
      if (reservedSlotIds.has(slot.id)) {
        throw new BadRequestException(
          'A task slot with a pending request cannot be edited until the request is decided',
        );
      }
      slot.taskDescription = text;
      await manager.save(slot);
    }
  }

  private assertCreator(team: StudyTeam, actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN && team.creatorId !== actor.id) {
      throw new ForbiddenException('Only the team creator can perform this action');
    }
  }
}
