# AGENTS.md

Backend for **StudyGO** (SVU university companion app). NestJS 12, TypeScript 6, Node 24, npm 11, PostgreSQL on Neon via TypeORM. ESM project.

## Layout
- `src/` — one folder per feature module: `auth/`, `users/`, `health/`, `programs/`, `semesters/`, `subjects/`, `professors/`, `sections/`, `enrollments/`, `teams/`, `tasks/`, `events/`, `notifications/`. All deployed modules are implemented.
- `src/common/` — shared DTOs, decorators, guards, filters, transformers, and pure utils (hashing, pagination, durations, grading, db helpers). Unit specs live beside source as `*.spec.ts`.
- `test/` — e2e specs (`test/app.e2e-spec.ts` covers health, auth-gating, 404s).
- `dist/` is build output from `nest build`; never treat it as source or edit it.
- **No seed script exists.** `README` and `.env.example` reference `npm run seed`, but `package.json` defines none; `ADMIN_EMAIL`/`ADMIN_PASSWORD` are read into config and never consumed.

## Critical toolchain quirks
- **ESM.** `"type": "module"` + `nodenext`. Every relative import MUST include the `.js` extension (`import { X } from './x.service.js'`), even for `.ts` files. Omitting it breaks build and runtime.
- **Linter is oxlint, not ESLint** (`oxlint.json`, dirs `src/ test/`). Run `npm run lint`.
- **Tests use vitest, not Jest.** Do not add Jest config/deps.
  - `npm test` = `vitest run` (unit glob `**/*.spec.ts`); needs no DB.
  - `npm run test:e2e` = vitest with `vitest.config.e2e.ts` (glob `**/*.e2e-spec.ts`); boots the full `AppModule` and needs a live `DATABASE_URL`.
  - single file: `npx vitest run src/foo/foo.service.spec.ts`; single test: `npx vitest run -t "name"`.
- **No `typecheck` script.** `npm run build` (`nest build` via `tsconfig.build.json`) is the typecheck, and it **excludes `**/*spec.ts`** — spec type errors won't fail the build.

## Commands
- `npm run start:dev` (watch) · `npm run build` (nest build) · `npm run start:prod` · `npm run format` (Prettier: single quotes, trailing commas).

## Config & database
- `.env` exists and may hold real Neon/JWT credentials; it is gitignored. **Never overwrite or commit it.** Document new vars in `.env.example`.
- `@nestjs/config` is global (loads `.env` via `envFilePath`); `import 'dotenv/config'` preloads `.env` at the top of `app.module.ts`, `main.ts`, and `src/data-source.ts`. Inject `ConfigService` via the typed `configuration()` factory in `src/config/configuration.ts`.
- Env vars (`.env.example`): `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGINS`, `SMTP_*`, `EMAIL_FROM`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `OBSERVE_*`. `PASSWORD_RESET_URL` is read by `MailService` but undocumented.
- Neon needs TLS: `DATABASE_SSL=true`; pooled endpoints need `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- TypeORM entity/migration registries are **explicit arrays, no globs**. A new entity MUST be added to `ENTITIES` in `src/database/entities.ts`; a new migration MUST be registered in `MIGRATIONS` in `src/database/migrations/index.ts`. Missing either silently drops it from the running app / CLI. `synchronize` stays off; migrate via `migration:generate` / `migration:run` / `migration:revert` / `migration:show` (all invoke the CLI through `tsx` with `-d src/data-source.ts`).
- `src/app.module.ts` only initializes `@nestjs/observe` when real `OBSERVE_APP_KEY`/`OBSERVE_APP_SECRET` are set (placeholder `YOUR_APP_KEY`/`YOUR_APP_SECRET` values are ignored), so local runs are quiet.

## Conventions & gotchas
- `main.ts` wires the global `/api` prefix + URI versioning (`/api/v1/...`), `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), Swagger at `/api/docs`, CORS, and Helmet (`contentSecurityPolicy: false` so Swagger UI renders).
- `ThrottlerGuard`, `JwtAuthGuard`, and `RolesGuard` are registered globally via `APP_GUARD`. **Every route is auth-required by default** — add `@Public()` to opt out and `@Roles(UserRole.ADMIN)` for admin-only; forgetting `@Public()` on a public route yields 401.
- Relations are deliberately **unidirectional** (child → parent `@ManyToOne`; subject `@ManyToMany` prerequisites) to avoid ESM circular-import failures at bootstrap.
- Postgres unique violations (SQLSTATE 23505, `isUniqueViolation` in `src/common/utils/db.util.ts`) are surfaced as 400 `BadRequestException`; `AllExceptionsFilter` hides internal details in production.
- **Grading scale is a documented PLACEHOLDER** in `src/common/utils/grading.util.ts` (A/B/C/D/F at 90/80/70/60, pass mark 60) pending SVU's official rules. Keep marks → GPA logic isolated there. Total mark = `projectMark*projectWeight/100 + examMark*examWeight/100`; subject weights must sum to 100.
- SMTP: with no `SMTP_*` configured, password-reset mail is skipped and the token is logged at warn level (`MailService`).
- TS is `strict` with `strictPropertyInitialization: false`; decorators enabled (`emitDecoratorMetadata`, `experimentalDecorators`).
