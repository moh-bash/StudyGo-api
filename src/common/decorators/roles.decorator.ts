import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../enums.js';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
