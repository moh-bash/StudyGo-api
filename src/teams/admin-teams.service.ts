import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { PaginatedResult } from '../common/interfaces.js';
import {
  JoinRequestStatus,
  TeamContactMethod,
  TeamScope,
  TeamStatus,
} from '../common/enums.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { QueryAdminTeamsDto } from './dto/query-admin-teams.dto.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';
import { TeamTaskSlot } from './entities/team-task-slot.entity.js';

/**
 * A team row shaped for the administration dashboard.
 *
 * This is a deliberately *read-only, monitoring* view: it exposes the facts an
 * administrator needs to audit teams (identity, subject/term, creator,
 * professor, section, scope, capacity, description, state) but **never** the
 * raw contact destination (`contactValue`). An admin sees the contact *method*
 * only; handing out invitation links or phone numbers by default would widen
 * the privacy surface the student feature deliberately keeps narrow.
 */
export interface AdminTeamView {
  id: string;
  name: string;
  description: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
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
  pendingRequestCount: number;
  contactMethod: TeamContactMethod | null;
  status: TeamStatus;
  createdAt: Date;
}

/** Aggregate figures rendered by the dashboard home summary cards. */
export interface TeamStats {
  totalTeams: number;
  totalMembers: number;
  totalOpenSlots: number;
  totalPendingRequests: number;
}

/**
 * Read-only administrator access to subject teams.
 *
 * Authorization is enforced at the controller (`@Roles(UserRole.ADMIN)`); this
 * service additionally never applies a per-caller visibility filter, because an
 * administrator is meant to see the global picture. Counting is always done in
 * the database, never by loading rows into memory.
 */
@Injectable()
export class AdminTeamsService {
  constructor(
    @InjectRepository(StudyTeam) private readonly teams: Repository<StudyTeam>,
    @InjectRepository(TeamMembership) private readonly memberships: Repository<TeamMembership>,
    @InjectRepository(TeamTaskSlot) private readonly slots: Repository<TeamTaskSlot>,
    @InjectRepository(TeamJoinRequest) private readonly requests: Repository<TeamJoinRequest>,
  ) {}

  /**
   * The global number of teams, computed by the database.
   *
   * `count()` is used (not `meta.total` of a page) so the value is the true
   * persisted total regardless of any page size, and it counts *teams* only —
   * never memberships, slots, or join requests.
   */
  async countTeams(): Promise<number> {
    return this.teams.count();
  }

  /** Aggregate team figures for the dashboard home. */
  async getStats(): Promise<TeamStats> {
    const [totalTeams, totalMembers, totalOpenSlots, totalPendingRequests] = await Promise.all([
      this.teams.count(),
      this.memberships.count(),
      this.slots
        .createQueryBuilder('slot')
        .where('slot.state = :open', { open: 'OPEN' })
        .getCount(),
      this.requests
        .createQueryBuilder('request')
        .where('request.status = :pending', { pending: JoinRequestStatus.PENDING })
        .getCount(),
    ]);
    return { totalTeams, totalMembers, totalOpenSlots, totalPendingRequests };
  }

  /**
   * Paginated, filtered, globally-scoped team list for administrators.
   *
   * Counts are resolved with two batched queries over the ids on the current
   * page (`In(...)`) — no per-row queries, so the list stays free of N+1.
   */
  async listTeams(query: QueryAdminTeamsDto): Promise<PaginatedResult<AdminTeamView>> {
    const qb = this.teams
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.subject', 'subject')
      .leftJoinAndSelect('team.semester', 'semester')
      .leftJoinAndSelect('team.section', 'section')
      .leftJoinAndSelect('team.professor', 'professor')
      .leftJoinAndSelect('team.creator', 'creator');

    if (query.semesterId) {
      qb.andWhere('team.semesterId = :semesterId', { semesterId: query.semesterId });
    }
    if (query.subjectId) {
      qb.andWhere('team.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.sectionId) {
      qb.andWhere('team.sectionId = :sectionId', { sectionId: query.sectionId });
    }
    if (query.professorId) {
      qb.andWhere('team.professorId = :professorId', { professorId: query.professorId });
    }
    if (query.scope) {
      qb.andWhere('team.scope = :scope', { scope: query.scope });
    }
    if (query.status) {
      qb.andWhere('team.status = :status', { status: query.status });
    }
    if (query.search) {
      // Search matches the team name, the subject (Arabic/English), or the
      // creator's name — the three things an administrator searches by.
      qb.andWhere(
        `(team.name ILIKE :search OR subject."nameAr" ILIKE :search OR subject."nameEn" ILIKE :search OR creator."fullName" ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('team.createdAt', 'DESC')
      .skip(getSkip(query.page, query.limit))
      .take(query.limit);

    const [teams, total] = await qb.getManyAndCount();
    const views = await this.buildViews(teams);
    return buildPaginatedResult(views, total, query.page, query.limit);
  }

  /** Batched (non-N+1) enrichment of a page of team rows. */
  private async buildViews(teams: StudyTeam[]): Promise<AdminTeamView[]> {
    if (teams.length === 0) {
      return [];
    }
    const teamIds = teams.map((t) => t.id);
    const [memberships, slots, pendingRequests] = await Promise.all([
      this.memberships.find({ where: { teamId: In(teamIds) } }),
      this.slots.find({ where: { teamId: In(teamIds) } }),
      this.requests.find({ where: { teamId: In(teamIds), status: JoinRequestStatus.PENDING } }),
    ]);

    const memberCount = new Map<string, number>();
    const openSlots = new Map<string, number>();
    const pendingCount = new Map<string, number>();
    for (const m of memberships) {
      memberCount.set(m.teamId, (memberCount.get(m.teamId) ?? 0) + 1);
    }
    for (const s of slots) {
      if (s.state === 'OPEN') {
        openSlots.set(s.teamId, (openSlots.get(s.teamId) ?? 0) + 1);
      }
    }
    for (const r of pendingRequests) {
      pendingCount.set(r.teamId, (pendingCount.get(r.teamId) ?? 0) + 1);
    }

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      subjectId: team.subjectId,
      subjectName: team.subject?.nameAr ?? team.subject?.nameEn ?? null,
      subjectCode: team.subject?.code ?? null,
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
      memberCount: memberCount.get(team.id) ?? 0,
      openSlotCount: openSlots.get(team.id) ?? 0,
      pendingRequestCount: pendingCount.get(team.id) ?? 0,
      contactMethod: team.contactMethod,
      status: team.status,
      createdAt: team.createdAt,
    }));
  }
}
