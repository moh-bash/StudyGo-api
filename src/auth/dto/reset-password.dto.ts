import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_REGEX } from './register.dto.js';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received by email.' })
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty({ example: 'N3wStr0ngPass', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_REGEX, { message: 'password must contain at least one letter and one number' })
  newPassword!: string;
}
