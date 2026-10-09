import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_REGEX } from '../../auth/dto/register.dto.js';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Str0ngPass' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'N3wStr0ngPass', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_REGEX, { message: 'password must contain at least one letter and one number' })
  newPassword!: string;
}
