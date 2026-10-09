import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { SemesterStatus } from '../../common/enums.js';

export class QuerySemestersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ enum: SemesterStatus })
  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;
}
