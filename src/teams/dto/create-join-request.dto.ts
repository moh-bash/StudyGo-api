import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJoinRequestDto {
  @ApiPropertyOptional({ description: 'Optional message to the team owner.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
