import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuthTokensDto {
  @ApiProperty({ description: 'Short-lived JWT access token.' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque refresh token. Store securely on the client.' })
  refreshToken!: string;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed' })
  message!: string;
}
