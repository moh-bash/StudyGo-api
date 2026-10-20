import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JoinRequestStatus, UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CreateSubjectJoinRequestDto } from './dto/create-subject-join-request.dto.js';
import { CreateTeamDto } from './dto/create-subject-team.dto.js';
import { QuerySubjectTeamsDto } from './dto/query-subject-teams.dto.js';
import { UpdateSubjectTeamDto } from './dto/update-subject-team.dto.js';
import {
  SubjectTeamsService,
  type CreatorJoinRequestView,
  type MySubjectTeamState,
  type SubjectTeamDetail,
} from './subject-teams.service.js';

/**
 * Phase 5 subject-team surface. Mounted under `/teams/subject` so it never
 * collides with the pre-existing generic team routes at `/teams/:id`.
 *
 * All routes require an authenticated session; student operations additionally
 * require the STUDENT role. Identity, eligibility and visibility are always
 * derived from the caller and the catalog — never trusted from the body.
 */
@ApiTags('teams')
@ApiBearerAuth('access-token')
@Controller('teams/subject')
export class SubjectTeamsController {
  constructor(private readonly subjectTeams: SubjectTeamsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Create a subject team (creator becomes the first member)' })
  @ApiCreatedResponse({ description: 'The created team with its task slots' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDto,
  ): Promise<SubjectTeamDetail> {
    return this.subjectTeams.createTeam(user, dto);
  }

  @Get('mine')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "The caller's team / membership / request state for a subject+term" })
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Query('semesterId', new ParseUUIDPipe()) semesterId: string,
    @Query('sectionId') sectionId?: string,
  ): Promise<MySubjectTeamState> {
    return this.subjectTeams.getMyState(user, subjectId, semesterId, sectionId);
  }

  @Get()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List subject teams visible to the caller for a subject+term' })
  @ApiOkResponse({ description: 'Paginated list of eligible teams' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QuerySubjectTeamsDto) {
    return this.subjectTeams.listTeams(user, query, query.sectionId);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Retrieve a team with its task slots (eligible callers only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SubjectTeamDetail> {
    return this.subjectTeams.getTeamDetail(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Edit permitted team fields (creator only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectTeamDto,
  ): Promise<SubjectTeamDetail> {
    return this.subjectTeams.updateTeam(user, id, dto);
  }

  @Post(':id/join-requests')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Request to join a specific open task slot' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'The created pending join request' })
  requestJoin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateSubjectJoinRequestDto,
  ): Promise<CreatorJoinRequestView> {
    return this.subjectTeams.createJoinRequest(user, id, dto);
  }

  @Get(':id/join-requests')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List join requests for a team (creator only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('status') status?: JoinRequestStatus,
  ): Promise<CreatorJoinRequestView[]> {
    return this.subjectTeams.listCreatorRequests(user, id, status);
  }

  @Patch(':id/join-requests/:requestId')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Accept or reject a join request (creator only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  decideRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body('approve') approve: boolean,
  ): Promise<CreatorJoinRequestView> {
    return this.subjectTeams.decideJoinRequest(user, id, requestId, approve === true);
  }

  @Delete(':id/join-requests/:requestId')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel my pending join request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  @ApiNoContentResponse()
  cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<void> {
    return this.subjectTeams.cancelJoinRequest(user, id, requestId);
  }
}
