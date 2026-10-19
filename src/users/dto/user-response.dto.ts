import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, UserRole } from '../../common/enums.js';

/**
 * Public representation of a user. Deliberately excludes `passwordHash` and any
 * authentication/token data.
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Layla Haddad' })
  fullName!: string;

  @ApiProperty({ example: 'layla@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  role!: UserRole;

  @ApiProperty({ enum: AccountStatus, example: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @ApiProperty({ nullable: true, example: null })
  profileImageUrl!: string | null;

  @ApiProperty({ nullable: true, example: 'SVU-2026-1234' })
  studentUniversityId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '+963 912 345 678',
    description: 'Optional contact phone number, or null when not provided.',
  })
  phone!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    example: null,
    description: 'Academic program id, or null when the user has no program assigned.',
  })
  programId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
