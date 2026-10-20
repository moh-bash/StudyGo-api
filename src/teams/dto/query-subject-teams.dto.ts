import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { TeamScope } from '../../common/enums.js';

/**
 * Filters for listing subject teams visible to the caller.
 *
 * `subjectId` and `semesterId` are required by the service-facing flow: a
 * student browses teams of one subject in one term. The service always applies
 * the caller's own eligibility, never a client-supplied section/professor.
 */
export class QuerySubjectTeamsDto extends PaginationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  semesterId!: string;

  @ApiPropertyOptional({ enum: TeamScope })
  @IsOptional()
  @IsEnum(TeamScope)
  scope?: TeamScope;
}
