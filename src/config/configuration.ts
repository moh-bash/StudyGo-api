function toBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Strongly-typed application configuration derived from environment variables.
 * Values are read once by `@nestjs/config` and injected via `ConfigService`.
 */
export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  database: {
    url: process.env.DATABASE_URL,
    ssl: toBool(process.env.DATABASE_SSL),
    sslRejectUnauthorized: toBool(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  mail: {
    host: process.env.SMTP_HOST || undefined,
    port: toInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || undefined,
  },
  admin: {
    email: process.env.ADMIN_EMAIL || undefined,
    password: process.env.ADMIN_PASSWORD || undefined,
  },
});
