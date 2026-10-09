import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'IT101', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'Introduction to Programming', maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameEn!: string;

  @ApiProperty({ example: 'مقدمة في البرمجة', maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 3, minimum: 0, maximum: 30 })
  @IsInt()
  @Min(0)
  @Max(30)
  creditHours!: number;

  @ApiPropertyOptional({
    example: 40,
    minimum: 0,
    maximum: 100,
    description: 'Project weight. Must be provided together with examWeight and sum to 100.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  projectWeight?: number;

  @ApiPropertyOptional({
    example: 60,
    minimum: 0,
    maximum: 100,
    description: 'Exam weight. Must be provided together with projectWeight and sum to 100.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  examWeight?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
