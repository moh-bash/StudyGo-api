import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_REGEX, PHONE_REGEX } from '../../auth/dto/register.dto.js';
import { UserRole } from '../../common/enums.js';

/**
 * Admin-only account creation (dashboard "create user").
 *
 * Deliberately mirrors `RegisterDto` for the shared fields and offers only the
 * two roles the ordinary admin role selector may assign — manager roles carry a
 * DB-derived academic scope and must be granted through the dedicated
 * academic-assignments endpoints, never a bare create. New accounts are always
 * created `ACTIVE`; status changes go through `PATCH /users/:id`.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Layla Haddad', minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({ example: 'layla@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'Str0ngPass',
    minLength: 8,
    maxLength: 72,
    description: 'At least 8 characters, containing a letter and a number.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_REGEX, { message: 'password must contain at least one letter and one number' })
  password!: string;

  @ApiPropertyOptional({
    enum: [UserRole.STUDENT, UserRole.ADMIN],
    default: UserRole.STUDENT,
    description: 'Defaults to STUDENT. Manager roles are rejected.',
  })
  @IsOptional()
  @IsIn([UserRole.STUDENT, UserRole.ADMIN])
  role?: UserRole;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a',
    description:
      'Academic program (specialization). The server validates that the program exists (any status, so operators can pre-assign accounts).',
  })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ example: 'SVU-2026-1234', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentUniversityId?: string;

  @ApiPropertyOptional({
    example: '+963 912 345 678',
    nullable: true,
    description: 'Optional contact phone number (5-20 digits).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid phone number (5-20 digits, optionally prefixed with +)',
  })
  phone?: string;
}
