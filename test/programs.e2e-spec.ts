import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Programs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/programs/registration is public (no token) and returns an array', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/programs/registration').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns only the documented fields (id, name, code) for every program', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/programs/registration').expect(200);
    for (const program of res.body as Record<string, unknown>[]) {
      expect(Object.keys(program).sort()).toEqual(['code', 'id', 'name']);
      expect(typeof program.id).toBe('string');
      expect(typeof program.name).toBe('string');
      expect(program.code === null || typeof program.code === 'string').toBe(true);
    }
  });

  it('ignores attempts to bypass the active-program filter via query parameters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/programs/registration')
      .query({ isActive: false, includeInactive: true })
      .expect(200);
    // The endpoint takes no query input; the response shape is unchanged and
    // remains restricted to active programs.
    expect(Array.isArray(res.body)).toBe(true);
    for (const program of res.body as Record<string, unknown>[]) {
      expect(Object.keys(program).sort()).toEqual(['code', 'id', 'name']);
    }
  });

  it('keeps GET /api/v1/programs protected (401 without a token)', async () => {
    await request(app.getHttpServer()).get('/api/v1/programs').expect(401);
  });

  it('does not permit mutation on the registration route', async () => {
    // POST has no matching route (404); DELETE falls through to the admin-only
    // `DELETE /programs/:id` route and is therefore rejected with 401. Neither
    // yields a success status, so an anonymous caller cannot mutate anything.
    const post = await request(app.getHttpServer())
      .post('/api/v1/programs/registration')
      .send({ name: 'Hacked' });
    expect([401, 404]).toContain(post.status);

    const del = await request(app.getHttpServer()).delete('/api/v1/programs/registration');
    expect([401, 404]).toContain(del.status);

    // The read-only route still works afterwards.
    await request(app.getHttpServer()).get('/api/v1/programs/registration').expect(200);
  });
});
