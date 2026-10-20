import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { TeamScope, TeamStatus } from '../../common/enums.js';

/**
 * Filters for the read-only administrator team list.
 *
 * Every filter is optional (an admin can list all teams); the values are
 * validated as UUIDs/enums so an invalid filter is rejected as a 400 rather
 * than reaching the database. There is deliberately no free access to contact
 * values here — the admin view exposes the contact *method* only.
 */
export class QueryAdminTeamsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by academic term' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by subject' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by originating section' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by professor' })
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional({ enum: TeamScope, description: 'Filter by eligibility scope' })
  @IsOptional()
  @IsEnum(TeamScope)
  scope?: TeamScope;

  @ApiPropertyOptional({ enum: TeamStatus, description: 'Filter by team state' })
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
