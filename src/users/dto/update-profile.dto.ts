import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PHONE_REGEX } from '../../auth/dto/register.dto.js';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Layla Haddad', minLength: 2, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileImageUrl?: string | null;

  @ApiPropertyOptional({ example: 'SVU-2026-1234', maxLength: 50, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentUniversityId?: string | null;

  @ApiPropertyOptional({
    example: '+963 912 345 678',
    nullable: true,
    description: 'Optional contact phone number (5-20 digits). Empty string clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid phone number (5-20 digits, optionally prefixed with +)',
  })
  phone?: string | null;
}
