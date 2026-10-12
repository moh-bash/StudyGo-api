import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignProgramManagerDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "The academic program the user will manage. This also becomes the user's own program (scope).",
  })
  @IsUUID()
  programId!: string;
}
