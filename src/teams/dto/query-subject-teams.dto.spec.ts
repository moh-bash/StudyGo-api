import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { QuerySubjectTeamsDto } from './query-subject-teams.dto.js';

/**
 * Regression coverage for a defect found in Phase 5.1 end-to-end testing.
 *
 * The list controller binds `@Query() query: QuerySubjectTeamsDto` while the
 * global pipe runs with `forbidNonWhitelisted: true`. `sectionId` was read via
 * a bare `@Query('sectionId')` and was *not* a declared DTO property, so any
 * request that carried it — which the mobile client does on every
 * browse/`mine` call — was rejected with `400 Bad Request`. The service-level
 * unit tests never hit this because they call the service directly and bypass
 * the pipe. These tests exercise the pipe itself.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const SUBJECT = '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a';
const SEMESTER = '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const SECTION = '2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e';

async function transform(value: Record<string, unknown>): Promise<QuerySubjectTeamsDto> {
  return pipe.transform(value, { type: 'query', metatype: QuerySubjectTeamsDto }) as Promise<QuerySubjectTeamsDto>;
}

describe('QuerySubjectTeamsDto', () => {
  it('accepts subject, semester and the planning sectionId', async () => {
    const dto = await transform({
      subjectId: SUBJECT,
      semesterId: SEMESTER,
      sectionId: SECTION,
    });
    expect(dto.subjectId).toBe(SUBJECT);
    expect(dto.semesterId).toBe(SEMESTER);
    expect(dto.sectionId).toBe(SECTION);
  });

  it('accepts a request without sectionId', async () => {
    const dto = await transform({ subjectId: SUBJECT, semesterId: SEMESTER });
    expect(dto.sectionId).toBeUndefined();
  });

  it('rejects a malformed sectionId', async () => {
    await expect(
      transform({ subjectId: SUBJECT, semesterId: SEMESTER, sectionId: 'not-a-uuid' }),
    ).rejects.toThrow();
  });

  it('rejects an undeclared filter (whitelist still enforced)', async () => {
    await expect(
      transform({ subjectId: SUBJECT, semesterId: SEMESTER, isAdmin: 'true' }),
    ).rejects.toThrow();
  });

  it('requires subjectId and semesterId', async () => {
    await expect(transform({ semesterId: SEMESTER })).rejects.toThrow();
    await expect(transform({ subjectId: SUBJECT })).rejects.toThrow();
  });

  it('coerces pagination and rejects an out-of-range limit', async () => {
    const dto = await transform({ subjectId: SUBJECT, semesterId: SEMESTER, page: '2', limit: '50' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    await expect(
      transform({ subjectId: SUBJECT, semesterId: SEMESTER, limit: '1000' }),
    ).rejects.toThrow();
  });

  it('accepts a valid scope and rejects an unknown one', async () => {
    const dto = await transform({ subjectId: SUBJECT, semesterId: SEMESTER, scope: 'PROFESSOR' });
    expect(dto.scope).toBe('PROFESSOR');
    await expect(
      transform({ subjectId: SUBJECT, semesterId: SEMESTER, scope: 'NOPE' }),
    ).rejects.toThrow();
  });
});
