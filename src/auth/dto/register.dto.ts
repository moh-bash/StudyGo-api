import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
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

  @ApiPropertyOptional({ example: 'SVU-2026-1234', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentUniversityId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a',
    description:
      'Existing academic program id. Optional — accounts may start without a program. When provided, the server validates that the program exists and is active.',
  })
  @IsOptional()
  @IsUUID()
  programId?: string;
}
