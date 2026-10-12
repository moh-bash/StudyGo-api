import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimal public projection of an active academic program, used by the
 * unauthenticated registration endpoint. Deliberately exposes only the fields a
 * registration dropdown needs; never the full `AcademicProgram` entity.
 */
export class RegistrationProgramDto {
  @ApiProperty({ format: 'uuid', example: '2b7f1c1e-8a2d-4f5a-9f4e-1c2d3e4f5a6b' })
  id!: string;

  @ApiProperty({ example: 'Information Technology' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'IT' })
  code!: string | null;
}
