import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums.js';

/**
 * Admin view of a user's role and academic management scope. Contains no
 * secrets — ids only.
 */
export class AcademicAssignmentsDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  role!: UserRole;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'The user\'s academic program (their field of study).',
  })
  programId!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'The program the user manages (equals `programId` for a Program Manager, else null).',
  })
  managedProgramId!: string | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Subject ids the user explicitly manages (Subject Manager only).',
  })
  managedSubjectIds!: string[];
}
