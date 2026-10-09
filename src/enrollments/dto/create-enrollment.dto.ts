import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ format: 'uuid', description: 'Section the student enrolls in.' })
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Admin only: enroll this student instead of the authenticated user.',
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
