import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { TeamContactMethod, TeamScope } from '../../common/enums.js';

/** One task slot supplied at team creation (same shape as an edit item). */
export class TeamTaskSlotInputDto {
  @ApiProperty({ example: 'حل السؤال الأول', minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  taskDescription!: string;
}

/**
 * Create a subject team.
 *
 * `sectionId` must be the creator's section for the subject+term; the server
 * derives the term and professor from it and never trusts client-supplied ids
 * for those. `taskSlots` must contain exactly `maxMembers` entries — the DB and
 * the service both reject a mismatched count, so a client cannot inflate or
 * shrink the slot count to bypass capacity or task validation.
 */
export class CreateTeamDto {
  @ApiProperty({ example: 'فريق حل مشروع الخوارزميات', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ format: 'uuid', description: "The creator's section for the subject+term." })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiProperty({ format: 'uuid', description: 'Academic term the team belongs to.' })
  @IsUUID()
  semesterId!: string;

  @ApiProperty({ enum: TeamScope, default: TeamScope.SECTION })
  @IsEnum(TeamScope)
  scope!: TeamScope;

  @ApiProperty({ example: 3, minimum: 2, maximum: 20, description: 'Total members, including the creator.' })
  @IsInt()
  @Min(2)
  @Max(20)
  maxMembers!: number;

  @ApiProperty({ type: [TeamTaskSlotInputDto], description: 'Exactly maxMembers task slots.' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TeamTaskSlotInputDto)
  taskSlots!: TeamTaskSlotInputDto[];

  @ApiProperty({ enum: TeamContactMethod })
  @IsEnum(TeamContactMethod)
  contactMethod!: TeamContactMethod;

  @ApiProperty({ example: '+966501234567', maxLength: 300 })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  contactValue!: string;
}
