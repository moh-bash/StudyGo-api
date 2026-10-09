# StudyGO API

Backend REST API for **StudyGO**, a companion app for Syrian Virtual University (SVU) students.

Built with NestJS 12, TypeScript (strict), TypeORM, and PostgreSQL (Neon). ESM project (`"type": "module"`).

## Features

- **Auth** — register, login, refresh/logout (hashed opaque refresh tokens), password reset (SMTP), JWT bearer access tokens with role-based guards.
- **Catalog** — academic programs, semesters, subjects (with prerequisite graph + grading weights), professors, sections (with weekly schedules).
- **Enrollment** — capacity + prerequisite checks, marks, credit-weighted GPA (grading scale is a **documented placeholder** — see below).
- **Social/Personal** — study teams (memberships, join requests, privacy), personal tasks, shared academic events, per-user notifications.
- **Ops** — `/api/v1/health` liveness, Swagger UI, global validation (`whitelist` + `forbidNonWhitelisted`), Helmet, CORS, throttling, Observe telemetry (only when `OBSERVE_*` is configured).

The API is served under `/api/v1/...` (global prefix `api`, URI version `1`). Interactive docs at `/api/docs`.

## Prerequisites

- Node 24+ and npm 11+
- A PostgreSQL database (Neon or local). `uuid-ossp`/`gen_random_uuid` must be available.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_ACCESS_SECRET, etc.
```

Required env vars: `DATABASE_URL` (Neon pooled endpoints usually need `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`), `JWT_ACCESS_SECRET`. `PORT` defaults to 3000. See `.env.example` for the full list. **Never commit or overwrite `.env`.**

Create the schema with the initial migration:

```bash
npm run migration:run
```

## Commands

```bash
npm run start:dev      # watch mode
npm run build          # compile to dist/
npm run start:prod     # node dist/main

npm run lint           # oxlint src/ test/
npm test               # vitest unit tests (src/**/*.spec.ts)
npm run test:e2e       # vitest end-to-end (test/**/*.e2e-spec.ts)
npm run format         # prettier

npm run migration:generate -- src/database/migrations/Name
npm run migration:run
npm run migration:revert
npm run migration:show
```

`npm test` (unit) needs no database; `npm run test:e2e` boots the full `AppModule`, so it requires a reachable `DATABASE_URL` (reads come from `.env`).

## Project layout

- `src/<feature>/` — one folder per module: `auth`, `users`, `programs`, `semesters`, `subjects`, `professors`, `sections`, `enrollments`, `teams`, `tasks`, `events`, `notifications`, `health`.
- `src/common/` — shared DTOs, decorators, guards, filters, transformers, and pure utils (grading, pagination, hashing, durations, db helpers).
- `src/database/migrations/` — TypeORM migrations; generated from entities, run against the live DB. `synchronize` is always off.
- `src/config/` — typed environment config, TypeORM data-source options, Swagger setup.
- `test/` — e2e specs (vitest + supertest).

## Design notes

- **ESM imports:** every relative import must end with `.js` (e.g. `import { X } from './x.service.js'`), even for `.ts` sources. Omitting the extension breaks `nest build` and runtime under `nodenext`.
- **Relations are unidirectional** (child → parent `@ManyToOne`; subject `@ManyToMany` prerequisites) to avoid ESM circular-import issues at bootstrap.
- **Persistence:** explicit `entities`/`migrations` arrays (no globs) in the TypeORM options. `synchronize: false`. The `migrations` table holds `InitialSchema...` as the current baseline.
- **Errors:** Postgres unique violations (SQLSTATE 23505) are mapped to 400-level `BadRequestException`; `AllExceptionsFilter` hides internal details in production.
- **Grading scale (PLACEHOLDER):** SVU's official rules are not yet modelled. `src/common/utils/grading.util.ts` ships a documented A/B/C/D/F scale (90/80/70/60) used by marks → GPA conversion and the `DEFAULT_PASS_MARK` (60). Total mark = `projectMark * projectWeight/100 + examMark * examWeight/100`; subject weights must sum to 100. Replace this file when the official rules are confirmed — GPA behaviour is isolated there.
- **Admin bootstrap:** `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars exist for first-admin seeding; the provider is wired through configuration but no seed script ships yet.

## License

UNLICENSED.