import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from '../database/entities.js';
import { MIGRATIONS } from '../database/migrations/index.js';

/**
 * Builds TypeORM options from environment variables. `synchronize` is always
 * false — schema changes go through migrations only. Neon requires TLS, and its
 * pooled endpoints usually need `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in .env (see .env.example) before starting the API.',
    );
  }

  const useSsl = (env.DATABASE_SSL ?? '').toLowerCase() === 'true';
  const rejectUnauthorized =
    (env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() === 'true';

  return {
    type: 'postgres',
    url,
    ssl: useSsl ? { rejectUnauthorized } : false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
}
