import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import {
  JoinRequestStatus,
  TeamRole,
  TeamStatus,
  TeamVisibility,
  UserRole,
} from '../common/enums.js';
import { isUniqueViolation } from '../common/utils/db.util.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { DecideJoinRequestDto } from './dto/decide-join-request.dto.js';
import { QueryTeamsDto } from './dto/query-teams.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';

export type TeamWithMembers = StudyTeam & { members: TeamMembership[] };

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(StudyTeam) private readonly teams: Repository<StudyTeam>,
    @InjectRepository(TeamMembership) private readonly memberships: Repository<TeamMembership>,
    @InjectRepository(TeamJoinRequest) private readonly requests: Repository<TeamJoinRequest>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(AcademicSection) private readonly sections: Repository<AcademicSection>,
    private readonly dataSource: DataSource,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateTeamDto): Promise<StudyTeam> {
    if (dto.subjectId && !(await this.subjects.exists({ where: { id: dto.subjectId } }))) {
      throw new BadRequestException('Subject not found');
    }
    if (dto.sectionId && !(await this.sections.exists({ where: { id: dto.sectionId } }))) {
      throw new BadRequestException('Section not found');
    }
    return this.dataSource.transaction(async (manager) => {
      const team = manager.create(StudyTeam, {
        name: dto.name.trim(),
        description: dto.description ?? null,
        subjectId: dto.subjectId ?? null,
        sectionId: dto.sectionId ?? null,
        creatorId: actor.id,
        maxMembers: dto.maxMembers ?? 5,
        visibility: dto.visibility ?? TeamVisibility.PUBLIC,
        status: TeamStatus.ACTIVE,
      });
      const saved = await manager.save(team);
      const membership = manager.create(TeamMembership, {
        teamId: saved.id,
        userId: actor.id,
        role: TeamRole.OWNER,
      });
      await manager.save(membership);
      return saved;
    });
  }

  async findAll(
    actor: AuthenticatedUser,
    query: QueryTeamsDto,
  ): Promise<PaginatedResult<StudyTeam>> {
    const qb = this.teams
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.subject', 'subject')
      .leftJoinAndSelect('team.section', 'section')
      .leftJoinAndSelect('team.creator', 'creator')
      .orderBy('team.createdAt', 'DESC');
    if (query.subjectId) {
      qb.andWhere('team.subjectId = :subjectId', { subjectId: query.subjectId });
    }
    if (query.sectionId) {
      qb.andWhere('team.sectionId = :sectionId', { sectionId: query.sectionId });
    }
    if (query.status) {
      qb.andWhere('team.status = :status', { status: query.status });
    }
    if (query.visibility) {
      qb.andWhere('team.visibility = :visibility', { visibility: query.visibility });
    }
    if (query.search) {
      qb.andWhere('team.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (actor.role !== UserRole.ADMIN) {
      qb.andWhere(
        `(team.visibility = :publicVisibility
          OR team.creatorId = :actorId
          OR team.id IN (SELECT m."teamId" FROM team_memberships m WHERE m."userId" = :actorId))`,
        { publicVisibility: TeamVisibility.PUBLIC, actorId: actor.id },
      );
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findMine(
    userId: string,
    query: QueryTeamsDto,
  ): Promise<PaginatedResult<StudyTeam>> {
    const qb = this.teams
      .createQueryBuilder('team')
      .innerJoin('team_memberships', 'membership', 'membership."teamId" = team.id')
      .leftJoinAndSelect('team.subject', 'subject')
      .leftJoinAndSelect('team.section', 'section')
      .leftJoinAndSelect('team.creator', 'creator')
      .where('membership."userId" = :userId', { userId })
      .orderBy('team.createdAt', 'DESC');
    if (query.status) {
      qb.andWhere('team.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('team.name ILIKE :search', { search: `%${query.search}%` });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<TeamWithMembers> {
    const team = await this.teams.findOne({
      where: { id },
      relations: { subject: true, section: true, creator: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const isMember = await this.memberships.exists({ where: { teamId: id, userId: actor.id } });
    if (
      team.visibility === TeamVisibility.PRIVATE &&
      actor.role !== UserRole.ADMIN &&
      team.creatorId !== actor.id &&
      !isMember
    ) {
      throw new ForbiddenException('This team is private');
    }
    const members = await this.memberships.find({
      where: { teamId: id },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    return Object.assign(team, { members });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateTeamDto): Promise<StudyTeam> {
    const team = await this.getOrFail(id);
    this.assertOwnerOrAdmin(team, actor);
    if (dto.subjectId !== undefined) {
      if (dto.subjectId && !(await this.subjects.exists({ where: { id: dto.subjectId } }))) {
        throw new BadRequestException('Subject not found');
      }
      team.subjectId = dto.subjectId ?? null;
    }
    if (dto.sectionId !== undefined) {
      if (dto.sectionId && !(await this.sections.exists({ where: { id: dto.sectionId } }))) {
        throw new BadRequestException('Section not found');
      }
      team.sectionId = dto.sectionId ?? null;
    }
    if (dto.name !== undefined) {
      team.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      team.description = dto.description;
    }
    if (dto.maxMembers !== undefined) {
      const count = await this.memberships.count({ where: { teamId: id } });
      if (dto.maxMembers < count) {
        throw new BadRequestException(`maxMembers cannot be lower than current member count (${count})`);
      }
      team.maxMembers = dto.maxMembers;
    }
    if (dto.visibility !== undefined) {
      team.visibility = dto.visibility;
    }
    if (dto.status !== undefined) {
      team.status = dto.status;
    }
    return this.teams.save(team);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const team = await this.getOrFail(id);
    this.assertOwnerOrAdmin(team, actor);
    await this.teams.remove(team);
  }

  async leave(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.getOrFail(id);
    const membership = await this.memberships.findOne({
      where: { teamId: id, userId: actor.id },
    });
    if (!membership) {
      throw new BadRequestException('You are not a member of this team');
    }
    if (membership.role === TeamRole.OWNER) {
      throw new BadRequestException('The owner cannot leave; transfer ownership or disband the team');
    }
    await this.memberships.remove(membership);
  }

  async removeMember(actor: AuthenticatedUser, teamId: string, userId: string): Promise<void> {
    const team = await this.getOrFail(teamId);
    this.assertOwnerOrAdmin(team, actor);
    const membership = await this.memberships.findOne({ where: { teamId, userId } });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.role === TeamRole.OWNER) {
      throw new BadRequestException('The owner cannot be removed from the team');
    }
    await this.memberships.remove(membership);
  }

  async listMembers(teamId: string): Promise<TeamMembership[]> {
    await this.getOrFail(teamId);
    return this.memberships.find({
      where: { teamId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
  }

  async createJoinRequest(
    actor: AuthenticatedUser,
    teamId: string,
    dto: CreateJoinRequestDto,
  ): Promise<TeamJoinRequest> {
    const team = await this.getOrFail(teamId);
    if (team.status !== TeamStatus.ACTIVE) {
      throw new BadRequestException('This team is not accepting join requests');
    }
    const isMember = await this.memberships.exists({ where: { teamId, userId: actor.id } });
    if (isMember) {
      throw new BadRequestException('You are already a member of this team');
    }
    const pending = await this.requests.exists({
      where: { teamId, studentId: actor.id, status: JoinRequestStatus.PENDING },
    });
    if (pending) {
      throw new BadRequestException('You already have a pending request for this team');
    }
    try {
      return await this.requests.save(
        this.requests.create({
          teamId,
          studentId: actor.id,
          message: dto.message ?? null,
          status: JoinRequestStatus.PENDING,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('You already have a pending request for this team');
      }
      throw error;
    }
  }

  async listJoinRequests(actor: AuthenticatedUser, teamId: string, status?: JoinRequestStatus) {
    const team = await this.getOrFail(teamId);
    this.assertOwnerOrAdmin(team, actor);
    const qb = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.student', 'student')
      .where('request.teamId = :teamId', { teamId })
      .orderBy('request.createdAt', 'DESC');
    if (status) {
      qb.andWhere('request.status = :status', { status });
    }
    return qb.getMany();
  }

  async decideJoinRequest(
    actor: AuthenticatedUser,
    teamId: string,
    requestId: string,
    dto: DecideJoinRequestDto,
  ): Promise<TeamJoinRequest> {
    const team = await this.getOrFail(teamId);
    this.assertOwnerOrAdmin(team, actor);
    const request = await this.requests.findOne({ where: { id: requestId, teamId } });
    if (!request) {
      throw new NotFoundException('Join request not found');
    }
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('This join request has already been decided');
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.status === JoinRequestStatus.APPROVED) {
        const count = await manager.count(TeamMembership, { where: { teamId } });
        if (count >= team.maxMembers) {
          throw new BadRequestException('Team is full');
        }
        const alreadyMember = await manager.exists(TeamMembership, {
          where: { teamId, userId: request.studentId },
        });
        if (!alreadyMember) {
          await manager.save(
            manager.create(TeamMembership, {
              teamId,
              userId: request.studentId,
              role: TeamRole.MEMBER,
            }),
          );
        }
      }
      request.status = dto.status;
      request.reviewedById = actor.id;
      request.decidedAt = new Date();
      return manager.save(request);
    });
  }

  async cancelJoinRequest(actor: AuthenticatedUser, teamId: string, requestId: string): Promise<void> {
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

  private async getOrFail(id: string): Promise<StudyTeam> {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  private assertOwnerOrAdmin(team: StudyTeam, actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN && team.creatorId !== actor.id) {
      throw new ForbiddenException('Only the team owner or an administrator can perform this action');
    }
  }
}
