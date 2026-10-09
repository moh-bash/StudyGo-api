import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AcademicEventType } from '../../common/enums.js';

export class CreateEventDto {
  @ApiProperty({ example: 'Midterm exam', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: AcademicEventType, default: AcademicEventType.OTHER })
  @IsOptional()
  @IsEnum(AcademicEventType)
  type?: AcademicEventType;

  @ApiProperty({ example: '2026-02-10T08:00:00.000Z' })
  @IsISO8601()
  startAt!: string;

  @ApiPropertyOptional({ example: '2026-02-10T10:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

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
}
