import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TeamVisibility } from '../../common/enums.js';

export class CreateTeamDto {
  @ApiProperty({ example: 'Algorithms Study Group', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ example: 5, minimum: 2, maximum: 50, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  maxMembers?: number;

  @ApiPropertyOptional({ enum: TeamVisibility, default: TeamVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(TeamVisibility)
  visibility?: TeamVisibility;
}
