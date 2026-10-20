import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TeamContactMethod } from '../../common/enums.js';
import { TeamTaskSlotInputDto } from './create-subject-team.dto.js';

/**
 * Edit the permitted fields of a team (creator only).
 *
 * Deliberately excludes subject, term, creator, originating section, professor
 * and scope — those are immutable through ordinary editing. `taskSlots`, when
 * supplied, must keep the same count as `maxMembers`, may only change text of
 * unoccupied slots, and never removes an occupied slot.
 */
export class UpdateSubjectTeamDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ minimum: 2, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxMembers?: number;

  @ApiPropertyOptional({ enum: TeamContactMethod })
  @IsOptional()
  @IsEnum(TeamContactMethod)
  contactMethod?: TeamContactMethod;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  contactValue?: string;

  /**
   * Full replacement list of task slots, keyed by `id`. Supplying a slot `id`
   * edits that slot's text; omitting an existing slot is rejected (slots are
   * never removed through editing).
   */
  @ApiPropertyOptional({ type: [TeamTaskSlotInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TeamTaskSlotInputDto)
  taskSlots?: UpdateTaskSlotInputDto[];
}

/** Task slot edit item: `id` identifies an existing slot to update. */
export class UpdateTaskSlotInputDto extends TeamTaskSlotInputDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;
}
