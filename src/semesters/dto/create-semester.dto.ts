import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SemesterStatus } from '../../common/enums.js';

export class CreateSemesterDto {
  @ApiProperty({ format: 'uuid', description: 'Owning academic program id' })
  @IsUUID()
  programId!: string;

  @ApiProperty({ example: 'Spring 2026', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'S26', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiPropertyOptional({ example: '2026-02-01', format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: SemesterStatus, default: SemesterStatus.PLANNED })
  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;
}
