import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetPrerequisitesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Full replacement list of prerequisite subject ids.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  prerequisiteIds!: string[];
}
