import type { UserRole } from './enums.js';

/** Shape attached to `request.user` by the JWT strategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Decoded JWT access-token payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/** Standard pagination envelope returned by list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
