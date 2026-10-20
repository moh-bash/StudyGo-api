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
 *
 * `sectionId` is the section the caller is *planning for*. It is declared here
 * (not only read as a bare `@Query('sectionId')`) because the global
 * `ValidationPipe` runs with `forbidNonWhitelisted: true`: an undeclared query
 * parameter is rejected with 400, and the mobile client sends `sectionId` on
 * every browse/`mine` request. It is always re-validated server-side and can
 * never widen access (see `SubjectTeamsService.resolveCallerSections`).
 */
export class QuerySubjectTeamsDto extends PaginationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  semesterId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: "The caller's planning section (re-validated)." })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ enum: TeamScope })
  @IsOptional()
  @IsEnum(TeamScope)
  scope?: TeamScope;
}
