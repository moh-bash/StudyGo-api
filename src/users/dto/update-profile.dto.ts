import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
