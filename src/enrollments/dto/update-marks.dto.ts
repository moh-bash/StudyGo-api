import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateMarksDto {
  @ApiPropertyOptional({ example: 85, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  projectMark?: number;

  @ApiPropertyOptional({ example: 72.5, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  examMark?: number;

  @ApiPropertyOptional({ default: true, description: 'Mark the result as verified by an admin.' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
