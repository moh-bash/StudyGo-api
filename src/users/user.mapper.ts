import type { User } from './entities/user.entity.js';
import type { UserResponseDto } from './dto/user-response.dto.js';

/** Maps a User entity to its safe public shape. Never exposes `passwordHash`. */
export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    profileImageUrl: user.profileImageUrl,
    studentUniversityId: user.studentUniversityId,
    phone: user.phone ?? null,
    programId: user.programId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
