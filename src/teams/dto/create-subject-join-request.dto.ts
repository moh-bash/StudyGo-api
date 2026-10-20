import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Submit a join request for a specific open task slot of a team. */
export class CreateSubjectJoinRequestDto {
  @ApiProperty({ format: 'uuid', description: 'The open task slot to request.' })
  @IsUUID()
  slotId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
