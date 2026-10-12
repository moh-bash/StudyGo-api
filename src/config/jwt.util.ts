import type { ConfigService } from '@nestjs/config';

/**
 * JWT signing-secret configuration helpers.
 *
 * The access-token signing secret is a security-critical value. The app rejects
 * a missing, empty, or obviously-weak secret at startup rather than silently
 * falling back to something predictable. Errors describe what to fix but never
 * include the secret value.
 */

export const MIN_JWT_SECRET_LENGTH = 32;

/** Known insecure placeholders that must never be accepted at runtime. */
const KNOWN_INSECURE_SECRETS = new Set<string>([
  'change-me',
  'change-me-to-a-long-random-string-at-least-32-chars',
  'changeme',
  'secret',
  'password',
  'jwt-secret',
  'jwt-access-secret',
  'my-secret',
  'your-secret',
]);

/**
 * Validates the raw environment value and returns it unchanged on success.
 * Throws on missing/empty/weak values. Applied in every environment so there
 * is never a predictable production fallback; development and test still use
 * this same defined secret (set in `.env`, documented in `.env.example`).
 */
export function resolveJwtAccessSecret(raw: string | undefined): string {
  const secret = raw?.trim() ?? '';
  if (secret.length === 0) {
    throw new Error(
      '[config] JWT_ACCESS_SECRET must be set. Generate a high-entropy value ' +
        '(at least 32 characters) and set it in .env / the deployment environment. ' +
        'Never commit it.',
    );
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH || KNOWN_INSECURE_SECRETS.has(secret)) {
    throw new Error(
      `[config] JWT_ACCESS_SECRET is rejected: it must be at least ` +
        `${MIN_JWT_SECRET_LENGTH} characters and must not be a known insecure placeholder. ` +
        `Generate a new random value and update the deployment.`,
    );
  }
  return secret;
}

/**
 * Reads the validated signing secret (and access-token lifetime) from the
 * application configuration. Centralizes the source so signing and verification
 * always agree. Throws if the configuration is somehow missing the secret.
 */
export function getValidatedJwtConfig(config: ConfigService): {
  secret: string;
  accessExpiresIn: string;
} {
  const secret = config.get<string>('jwt.accessSecret');
  if (!secret) {
    throw new Error(
      '[config] jwt.accessSecret is not configured; the application must not start without it.',
    );
  }
  const accessExpiresIn = config.get<string>('jwt.accessExpiresIn') ?? '15m';
  return { secret, accessExpiresIn };
}