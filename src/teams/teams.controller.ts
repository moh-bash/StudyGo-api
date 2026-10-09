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
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { DecideJoinRequestDto } from './dto/decide-join-request.dto.js';
import { QueryJoinRequestsDto } from './dto/query-join-requests.dto.js';
import { QueryTeamsDto } from './dto/query-teams.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@ApiBearerAuth('access-token')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a study team (creator becomes owner)' })
  @ApiCreatedResponse({ type: StudyTeam })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto): Promise<StudyTeam> {
    return this.teamsService.create(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List teams I belong to' })
  findMine(@CurrentUser('id') userId: string, @Query() query: QueryTeamsDto) {
    return this.teamsService.findMine(userId, query);
  }

  @Get()
  @ApiOperation({ summary: 'List / search visible teams' })
  @ApiOkResponse({ description: 'Paginated list of teams' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTeamsDto) {
    return this.teamsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team with its members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.teamsService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a team (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<StudyTeam> {
    return this.teamsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disband a team (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.teamsService.remove(user, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List team members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listMembers(@Param('id', new ParseUUIDPipe()) id: string): Promise<TeamMembership[]> {
    return this.teamsService.listMembers(id);
  }

  @Delete(':id/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a team (members other than the owner)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.teamsService.leave(user, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiNoContentResponse()
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    return this.teamsService.removeMember(user, id, userId);
  }

  @Get(':id/join-requests')
  @ApiOperation({ summary: 'List join requests for a team (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listJoinRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryJoinRequestsDto,
  ): Promise<TeamJoinRequest[]> {
    return this.teamsService.listJoinRequests(user, id, query.status);
  }

  @Post(':id/join-requests')
  @ApiOperation({ summary: 'Request to join a team' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: TeamJoinRequest })
  createJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateJoinRequestDto,
  ): Promise<TeamJoinRequest> {
    return this.teamsService.createJoinRequest(user, id, dto);
  }

  @Patch(':id/join-requests/:requestId')
  @ApiOperation({ summary: 'Approve or reject a join request (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  decideJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() dto: DecideJoinRequestDto,
  ): Promise<TeamJoinRequest> {
    return this.teamsService.decideJoinRequest(user, id, requestId, dto);
  }

  @Delete(':id/join-requests/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel my pending join request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'requestId', format: 'uuid' })
  @ApiNoContentResponse()
  cancelJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<void> {
    return this.teamsService.cancelJoinRequest(user, id, requestId);
  }
}
