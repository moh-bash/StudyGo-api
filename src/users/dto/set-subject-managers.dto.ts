import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

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
}
