import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { AuthController } from './auth.controller.js';

/**
 * Metadata keys used by `@nestjs/throttler`'s `@Throttle` decorator
 * (`THROTTLER_LIMIT`/`THROTTLER_TTL` plus the tracker name — the package does
 * not re-export these constants from its entry point).
 */
const THROTTLER_LIMIT_DEFAULT = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL_DEFAULT = 'THROTTLER:TTLdefault';

type MetadataTarget = object;

function metadata(key: string, handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(key, handler as MetadataTarget);
}

const routeHandlers = {
  register: AuthController.prototype.register,
  login: AuthController.prototype.login,
  refresh: AuthController.prototype.refresh,
  logout: AuthController.prototype.logout,
  forgotPassword: AuthController.prototype.forgotPassword,
  resetPassword: AuthController.prototype.resetPassword,
  me: AuthController.prototype.me,
} satisfies Record<string, (...args: never[]) => unknown>;

describe('AuthController route visibility', () => {
  it.each(['register', 'login', 'refresh', 'forgotPassword', 'resetPassword'] as const)(
    'keeps %s public',
    (name) => {
      expect(metadata(IS_PUBLIC_KEY, routeHandlers[name])).toBe(true);
    },
  );

  it('makes logout public so revocation works with an expired access token', () => {
    // Phase 1: logout is authorized by refresh-token possession, not by a
    // possibly-expired bearer token — without this a long-idle sign-out
    // silently leaves the server-side refresh session alive.
    expect(metadata(IS_PUBLIC_KEY, routeHandlers.logout)).toBe(true);
  });

  it('rate-limits logout on top of the global throttle', () => {
    // `@Throttle({ default: { limit, ttl } })` stores `THROTTLER:LIMIT + tracker`
    // and `THROTTLER:TTL + tracker` on the handler (see throttler.decorator.js).
    expect(metadata(THROTTLER_LIMIT_DEFAULT, routeHandlers.logout)).toBe(30);
    expect(metadata(THROTTLER_TTL_DEFAULT, routeHandlers.logout)).toBe(60_000);
  });

  it('keeps GET /auth/me authenticated (no public opt-in)', () => {
    expect(metadata(IS_PUBLIC_KEY, routeHandlers.me)).toBeUndefined();
  });
});
