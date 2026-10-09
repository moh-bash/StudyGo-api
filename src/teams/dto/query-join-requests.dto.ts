import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { JoinRequestStatus } from '../../common/enums.js';

export class QueryJoinRequestsDto {
  @ApiPropertyOptional({ enum: JoinRequestStatus })
  @IsOptional()
  @IsEnum(JoinRequestStatus)
  status?: JoinRequestStatus;
}
