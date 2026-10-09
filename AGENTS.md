# AGENTS.md

Backend for **StudyGO** (SVU university companion app). NestJS 12, TypeScript 6, Node 24, npm 11, PostgreSQL on Neon via TypeORM.

## Layout
- `src/` — one folder per feature module: `auth/`, `users/`, `health/`, `programs/`, `semesters/`, `subjects/`, `professors/`, `sections/`, `enrollments/`, `teams/`, `tasks/`, `events/`, `notifications/`. All deployed modules are implemented; only the SMTP mailer and admin-seeding utilities remain stubbed behind env-var gates.
- `test/` — e2e specs (`test/app.e2e-spec.ts` covers health, auth-gating, 404s).
- `dist/` is build output produced by `nest build`. Never treat it as source or edit it.

## Critical toolchain quirks
- **ESM project.** `package.json` has `"type": "module"` and tsconfig uses `nodenext`. Every relative import MUST include the `.js` extension (`import { X } from './x.service.js'`), even for `.ts` files. Omitting it breaks build and runtime.
- **Linter is oxlint, not ESLint** (`oxlint.json`, config dir `src/ test/`). Run `npm run lint`.
- **Tests use vitest, not Jest.** Do not add Jest config/deps.
  - `npm test` = `vitest run` (unit glob `**/*.spec.ts`)
  - `npm run test:e2e` = vitest with `vitest.config.e2e.ts` (glob `**/*.e2e-spec.ts`)
  - single file: `npx vitest run src/foo/foo.service.spec.ts`; single test: `npx vitest run -t "name"`
- `npm test` passes (unit specs live alongside source in `src/**/*.spec.ts`; pure utils + mocked service specs, no DB required). `npm run test:e2e` boots the full `AppModule` and needs a live `DATABASE_URL`.

## Commands
- `npm run start:dev` (watch) · `npm run build` (nest build) · `npm run start:prod` · `npm run format` (Prettier: single quotes, trailing commas)

## Config & database
- `.env` exists and may hold real Neon/JWT credentials; it is gitignored. **Never overwrite or commit it.** Document new vars in `.env.example`.
- `@nestjs/config` is imported in `src/app.module.ts` (global, loads `.env` via `envFilePath`), and `import 'dotenv/config'` preloads `.env` at the top of `app.module.ts`, `main.ts`, and `src/data-source.ts`. `ConfigService` is injected via the typed `configuration()` factory in `src/config/configuration.ts`.
- Documented env vars (`.env.example`): `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGINS`, `SMTP_*`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `OBSERVE_*`.
- Neon needs TLS: `DATABASE_SSL=true`; pooled endpoints need `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- TypeORM `DataSource` (`src/data-source.ts`, built from `buildDataSourceOptions`) + entities + an applied initial migration exist. `synchronize` stays off; migrate via the npm scripts `migration:generate` / `migration:run` / `migration:revert` / `migration:show` (all invoke the CLI through `tsx` with `-d src/data-source.ts`). Generated migrations are registered in `src/database/migrations/index.ts`.
- `src/app.module.ts` only initializes `@nestjs/observe` when real `OBSERVE_APP_KEY`/`OBSERVE_APP_SECRET` are set (placeholder `YOUR_APP_KEY`/`YOUR_APP_SECRET` values are ignored), so local runs are quiet.

## Conventions
- `main.ts` wires the global `/api` prefix + URI versioning (`/api/v1/...`), `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), Swagger at `/api/docs`, CORS, and Helmet (`contentSecurityPolicy: false` so Swagger UI renders). Global `ThrottlerGuard`, `JwtAuthGuard`, and `RolesGuard` are registered via `APP_GUARD` in `AppModule`.
- TS is `strict` with `strictPropertyInitialization: false`; decorators enabled (`emitDecoratorMetadata`, `experimentalDecorators`).
