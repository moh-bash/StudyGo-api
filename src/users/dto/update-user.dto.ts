import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountStatus, UserRole } from '../../common/enums.js';
import { UpdateProfileDto } from './update-profile.dto.js';

/** Admin-only update. Role/status can only be changed through this DTO. */
export class UpdateUserDto extends PartialType(UpdateProfileDto) {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
