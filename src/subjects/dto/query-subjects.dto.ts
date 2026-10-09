import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ActivePaginationQueryDto } from '../../common/dto/active-pagination-query.dto.js';

export class QuerySubjectsDto extends ActivePaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programId?: string;
}
