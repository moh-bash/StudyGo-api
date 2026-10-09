import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TeamStatus } from '../../common/enums.js';
import { CreateTeamDto } from './create-team.dto.js';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({ enum: TeamStatus, description: 'Archive or reactivate the team.' })
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
