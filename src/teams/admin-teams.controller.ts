import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import type { PaginatedResult } from '../common/interfaces.js';
import { AdminTeamsService, type AdminTeamView, type TeamStats } from './admin-teams.service.js';
import { QueryAdminTeamsDto } from './dto/query-admin-teams.dto.js';

/**
 * Read-only administrator surface for subject teams.
 *
 * Mounted under `/teams/admin` (concrete segment) so it never collides with the
 * generic `/teams/:id` route and is registered before it. Access is restricted
 * to the system `ADMIN` role via `@Roles`; the guard runs before the handler, so
 * a student or manager receives `403` without any team data being read.
 */
@ApiTags('teams')
@ApiBearerAuth('access-token')
@Controller('teams/admin')
@Roles(UserRole.ADMIN)
export class AdminTeamsController {
  constructor(private readonly adminTeams: AdminTeamsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate team figures (global team count etc.)' })
  @ApiOkResponse({ description: 'Database-computed team totals' })
  stats(): Promise<TeamStats> {
    return this.adminTeams.getStats();
  }

  @Get('count')
  @ApiOperation({ summary: 'Total number of teams (database count, ignoring pagination)' })
  @ApiOkResponse({ description: 'The global persisted team count' })
  async count(): Promise<{ total: number }> {
    return { total: await this.adminTeams.countTeams() };
  }

  @Get()
  @ApiOperation({ summary: 'List / search teams across the institution' })
  @ApiOkResponse({ description: 'Paginated, filtered list of teams' })
  list(@Query() query: QueryAdminTeamsDto): Promise<PaginatedResult<AdminTeamView>> {
    return this.adminTeams.listTeams(query);
  }
}
