import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

export class SetSubjectManagersDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      "Full replacement list of subject ids the user may manage. Every subject must belong to the user's own academic program. An empty list removes all subject-manager assignments.",
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds!: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Optional: set the user's academic program in the same call. The listed subjects must belong to this program. Required if the user has no program yet.",
  })
  @IsOptional()
  @IsUUID()
  programId?: string;
}
