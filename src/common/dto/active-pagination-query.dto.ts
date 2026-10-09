import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';

/** Pagination query that additionally supports filtering on `isActive`. */
export class ActivePaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  isActive?: boolean;
}
