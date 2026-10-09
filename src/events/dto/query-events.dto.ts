import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { AcademicEventType } from '../../common/enums.js';

export class QueryEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AcademicEventType })
  @IsOptional()
  @IsEnum(AcademicEventType)
  type?: AcademicEventType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Only events starting at/after this ISO date' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Only events starting at/before this ISO date' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
