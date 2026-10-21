/**
 * Route-table test for the Phase 5 subject-team surface.
 *
 * Boots the real Nest application metadata (no database, no HTTP listener) and
 * asserts that every `/teams/subject/*` route is registered, and that the
 * pre-existing generic `/teams/:id` route can never shadow it. Mounting the
 * subject surface under the same `teams` controller prefix is the risk this
 * guards: registration order decides which handler a request hits.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it } from 'vitest';
import { AdminTeamsController } from './admin-teams.controller.js';
import { AdminTeamsService } from './admin-teams.service.js';
import { SubjectTeamsController } from './subject-teams.controller.js';
import { SubjectTeamsService } from './subject-teams.service.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

/** A stub service: this test only asserts route registration, never behaviour. */
const stub = {} as never;

@Module({
  controllers: [SubjectTeamsController, AdminTeamsController, TeamsController],
  providers: [
    { provide: SubjectTeamsService, useValue: stub },
    { provide: AdminTeamsService, useValue: stub },
    { provide: TeamsService, useValue: stub },
  ],
})
class RouteProbeModule {}

interface RouteInfo {
  path: string;
  method: string;
}

/** Reads the Express router stack Nest built from the controllers. */
async function collectRoutes(): Promise<RouteInfo[]> {
  const app = await NestFactory.create<NestExpressApplication>(RouteProbeModule, { logger: false });
  await app.init();
  const server = app.getHttpAdapter().getInstance() as {
    router?: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
  };
  const stack = server.router?.stack ?? [];
  const routes: RouteInfo[] = [];
  for (const layer of stack) {
    if (!layer.route) {
      continue;
    }
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ path: layer.route.path, method: method.toUpperCase() });
    }
  }
  await app.close();
  return routes;
}

describe('subject-team route registration', () => {
  it('registers the full /teams/subject surface', async () => {
    const routes = await collectRoutes();
    const paths = routes.map((route) => `${route.method} ${route.path}`);

    for (const expected of [
      'POST /teams/subject',
      'GET /teams/subject/mine',
      'GET /teams/subject',
      'GET /teams/subject/:id',
      'PATCH /teams/subject/:id',
      'POST /teams/subject/:id/join-requests',
      'GET /teams/subject/:id/join-requests',
      'PATCH /teams/subject/:id/join-requests/:requestId',
      'DELETE /teams/subject/:id/join-requests/:requestId',
      'DELETE /teams/subject/:id/members/me',
      'DELETE /teams/subject/:id',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('never lets the generic /teams/:id delete shadow the subject-team delete', async () => {
    const routes = await collectRoutes();
    const paths = routes.map((route) => `${route.method} ${route.path}`);
    // The subject surface must own `DELETE /teams/subject/:id`; the generic
    // surface must not expose a competing delete on the same path.
    expect(paths).toContain('DELETE /teams/subject/:id');
    expect(paths).not.toContain('DELETE /teams/subject');
  });

  it('registers the subject surface before the generic /teams/:id routes', async () => {
    const routes = await collectRoutes();
    const genericIndex = routes.findIndex(
      (route) => route.method === 'GET' && route.path === '/teams/:id',
    );
    const mineIndex = routes.findIndex(
      (route) => route.method === 'GET' && route.path === '/teams/subject/mine',
    );
    const subjectIndex = routes.findIndex(
      (route) => route.method === 'GET' && route.path === '/teams/subject',
    );

    expect(mineIndex).toBeGreaterThanOrEqual(0);
    expect(subjectIndex).toBeGreaterThanOrEqual(0);
    expect(genericIndex).toBeGreaterThanOrEqual(0);
    // Express matches in registration order: both subject routes must come first
    // so `/teams/subject` and `/teams/subject/mine` never fall into `/:id`.
    expect(mineIndex).toBeLessThan(genericIndex);
    expect(subjectIndex).toBeLessThan(genericIndex);
  });

  it('keeps the generic team routes intact for backward compatibility', async () => {
    const routes = await collectRoutes();
    const paths = routes.map((route) => `${route.method} ${route.path}`);
    expect(paths).toContain('GET /teams/:id/members');
    expect(paths).toContain('GET /teams/me');
  });

  it('registers the administrator surface', async () => {
    const routes = await collectRoutes();
    const paths = routes.map((route) => `${route.method} ${route.path}`);
    for (const expected of [
      'GET /teams/admin',
      'GET /teams/admin/stats',
      'GET /teams/admin/count',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('registers the admin surface before the generic /teams/:id route', async () => {
    const routes = await collectRoutes();
    const genericIndex = routes.findIndex(
      (route) => route.method === 'GET' && route.path === '/teams/:id',
    );
    const adminIndex = routes.findIndex(
      (route) => route.method === 'GET' && route.path === '/teams/admin',
    );
    expect(adminIndex).toBeGreaterThanOrEqual(0);
    expect(genericIndex).toBeGreaterThanOrEqual(0);
    expect(adminIndex).toBeLessThan(genericIndex);
  });
});
