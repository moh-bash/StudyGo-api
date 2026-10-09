import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Weekday } from '../../common/enums.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateSectionScheduleDto {
  @ApiProperty({ enum: Weekday, example: Weekday.MONDAY })
  @IsEnum(Weekday)
  dayOfWeek!: Weekday;

  @ApiProperty({ example: '09:00', description: '24h wall-clock time (HH:MM or HH:MM:SS)' })
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:MM or HH:MM:SS' })
  startTime!: string;

  @ApiProperty({ example: '10:30', description: '24h wall-clock time (HH:MM or HH:MM:SS)' })
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:MM or HH:MM:SS' })
  endTime!: string;

  @ApiPropertyOptional({ example: 'Lab 3' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;
}
