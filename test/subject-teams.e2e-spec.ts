import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  AccountStatus,
  DeliveryMode,
  EnrollmentStatus,
  SemesterStatus,
  TeamContactMethod,
  TeamScope,
  UserRole,
} from '../src/common/enums.js';
import { getValidatedJwtConfig } from '../src/config/jwt.util.js';
import { StudentEnrollment } from '../src/enrollments/entities/enrollment.entity.js';
import { Professor } from '../src/professors/entities/professor.entity.js';
import { AcademicProgram } from '../src/programs/entities/program.entity.js';
import { AcademicSection } from '../src/sections/entities/section.entity.js';
import { Semester } from '../src/semesters/entities/semester.entity.js';
import { Subject } from '../src/subjects/entities/subject.entity.js';
import { StudyTeam } from '../src/teams/entities/study-team.entity.js';
import { TeamMembership } from '../src/teams/entities/team-membership.entity.js';
import { User } from '../src/users/entities/user.entity.js';

const freshId = () => crypto.randomUUID();

// The shared Neon database is reached over the public internet; individual
// requests (transactional create/accept, multi-join reads) can take longer than
// vitest's default 5s budget. This suite is black-box integration, so a longer
// per-test budget is appropriate rather than a sign of a slow code path.
const SLOW = 30000;

/**
 * Phase 5.1 end-to-end integration coverage for subject teams and the read-only
 * administrator surface, against the real (migrated) database.
 *
 * Every fixture is prefixed `P51-E2E` and created/removed inside this suite;
 * pre-existing shared records are never touched. Two students in the same
 * program drive the create → request → accept/reject workflow, and an admin
 * token exercises the `/teams/admin` endpoints.
 */
describe('Subject teams + admin (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  let usersRepo: Repository<User>;
  let programsRepo: Repository<AcademicProgram>;
  let subjectsRepo: Repository<Subject>;
  let semestersRepo: Repository<Semester>;
  let professorsRepo: Repository<Professor>;
  let sectionsRepo: Repository<AcademicSection>;
  let enrollmentsRepo: Repository<StudentEnrollment>;
  let teamsRepo: Repository<StudyTeam>;
  let membershipsRepo: Repository<TeamMembership>;

  let program: AcademicProgram;
  let subject: Subject;
  let semester: Semester;
  let professorA: Professor;
  let professorB: Professor;
  let sectionA: AcademicSection;
  let sectionB: AcademicSection;
  let sectionOtherProf: AcademicSection;

  let creator: User;
  let joiner: User;
  let stranger: User;
  let admin: User;
  let creatorToken: string;
  let joinerToken: string;
  let strangerToken: string;
  let adminToken: string;

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

    dataSource = app.get(DataSource);
    usersRepo = dataSource.getRepository(User);
    programsRepo = dataSource.getRepository(AcademicProgram);
    subjectsRepo = dataSource.getRepository(Subject);
    semestersRepo = dataSource.getRepository(Semester);
    professorsRepo = dataSource.getRepository(Professor);
    sectionsRepo = dataSource.getRepository(AcademicSection);
    enrollmentsRepo = dataSource.getRepository(StudentEnrollment);
    teamsRepo = dataSource.getRepository(StudyTeam);
    membershipsRepo = dataSource.getRepository(TeamMembership);

    jwt = new JwtService({ secret: getValidatedJwtConfig(app.get(ConfigService)).secret });

    const suffix = freshId().slice(0, 8);
    program = await programsRepo.save(
      programsRepo.create({ name: `P51-E2E Program ${suffix}`, code: `P51E2E_${suffix}` }),
    );
    subject = await subjectsRepo.save(
      subjectsRepo.create({
        code: `P51T_${suffix}`,
        nameEn: `P51-E2E Subject ${suffix}`,
        nameAr: `مادة P51 ${suffix}`,
        creditHours: 3,
        programId: program.id,
        isActive: true,
      }),
    );
    semester = await semestersRepo.save(
      semestersRepo.create({
        programId: program.id,
        name: `P51-E2E Term ${suffix}`,
        code: `P51S_${suffix}`,
        status: SemesterStatus.ACTIVE,
      }),
    );
    professorA = await professorsRepo.save(
      professorsRepo.create({ name: `P51 Prof A ${suffix}`, email: `p51.a.${suffix}@studygo.example` }),
    );
    professorB = await professorsRepo.save(
      professorsRepo.create({ name: `P51 Prof B ${suffix}`, email: `p51.b.${suffix}@studygo.example` }),
    );
    sectionA = await sectionsRepo.save(
      sectionsRepo.create({
        semesterId: semester.id,
        subjectId: subject.id,
        professorId: professorA.id,
        code: '01',
        deliveryMode: DeliveryMode.ON_CAMPUS,
        capacity: 40,
        isActive: true,
      }),
    );
    sectionB = await sectionsRepo.save(
      sectionsRepo.create({
        semesterId: semester.id,
        subjectId: subject.id,
        professorId: professorA.id,
        code: '02',
        deliveryMode: DeliveryMode.ON_CAMPUS,
        capacity: 40,
        isActive: true,
      }),
    );
    sectionOtherProf = await sectionsRepo.save(
      sectionsRepo.create({
        semesterId: semester.id,
        subjectId: subject.id,
        professorId: professorB.id,
        code: '03',
        deliveryMode: DeliveryMode.ON_CAMPUS,
        capacity: 40,
        isActive: true,
      }),
    );

    const mkUser = (label: string, role: UserRole) =>
      usersRepo.save(
        usersRepo.create({
          fullName: `P51-E2E ${label}`,
          email: `p51.e2e.${label.toLowerCase()}.${suffix}@studygo.example`,
          passwordHash: `p51-hash-${freshId()}`,
          role,
          status: AccountStatus.ACTIVE,
          programId: program.id,
        }),
      );
    creator = await mkUser('Creator', UserRole.STUDENT);
    joiner = await mkUser('Joiner', UserRole.STUDENT);
    stranger = await mkUser('Stranger', UserRole.STUDENT);
    admin = await mkUser('Admin', UserRole.ADMIN);

    // Real enrollments (source of truth for eligibility).
    await enrollmentsRepo.save(
      enrollmentsRepo.create({
        studentId: creator.id,
        sectionId: sectionA.id,
        status: EnrollmentStatus.ENROLLED,
      }),
    );
    await enrollmentsRepo.save(
      enrollmentsRepo.create({
        studentId: joiner.id,
        sectionId: sectionB.id,
        status: EnrollmentStatus.ENROLLED,
      }),
    );
    await enrollmentsRepo.save(
      enrollmentsRepo.create({
        studentId: stranger.id,
        sectionId: sectionOtherProf.id,
        status: EnrollmentStatus.ENROLLED,
      }),
    );

    const sign = (u: User) => jwt.signAsync({ sub: u.id, email: u.email, role: u.role });
    creatorToken = await sign(creator);
    joinerToken = await sign(joiner);
    strangerToken = await sign(stranger);
    adminToken = await sign(admin);
  }, 60000);

  afterAll(async () => {
    // Remove only what this run created, in dependency order.
    const teamIds = (await teamsRepo.find({ where: { creatorId: creator.id } })).map((t) => t.id);
    if (teamIds.length > 0) {
      await dataSource.query('DELETE FROM team_join_requests WHERE "teamId" = ANY($1)', [teamIds]);
      await dataSource.query('DELETE FROM team_task_slots WHERE "teamId" = ANY($1)', [teamIds]);
      await membershipsRepo.delete({ teamId: teamIds[0] });
      await teamsRepo.delete(teamIds);
    }
    await enrollmentsRepo.delete({ studentId: creator.id });
    await enrollmentsRepo.delete({ studentId: joiner.id });
    await enrollmentsRepo.delete({ studentId: stranger.id });
    await sectionsRepo.remove([sectionOtherProf, sectionB, sectionA]);
    await subjectsRepo.remove([subject]);
    await semestersRepo.remove([semester]);
    await professorsRepo.remove([professorB, professorA]);
    await usersRepo.remove([admin, stranger, joiner, creator]);
    await programsRepo.remove([program]);
    await app.close();
  }, 60000);

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const base = '/api/v1/teams/subject';

  const createBody = (over: Record<string, unknown> = {}) => ({
    name: 'P51-E2E Team Alpha',
    description: 'Phase 5.1 verification',
    subjectId: subject.id,
    sectionId: sectionA.id,
    semesterId: semester.id,
    scope: TeamScope.SECTION,
    maxMembers: 3,
    contactMethod: TeamContactMethod.TELEGRAM,
    contactValue: 'p51_handle',
    taskSlots: [
      { taskDescription: 'Task one' },
      { taskDescription: 'Task two' },
      { taskDescription: 'Task three' },
    ],
    ...over,
  });

  let teamId = '';
  let slot2Id = '';
  let slot3Id = '';

  // ---------------------------------------------------------------------------
  // Authorization basics
  // ---------------------------------------------------------------------------

  it('requires authentication on every subject-team route', async () => {
    await http().get(`${base}?subjectId=${subject.id}&semesterId=${semester.id}`).expect(401);
    await http().post(base).send(createBody()).expect(401);
  });

  // ---------------------------------------------------------------------------
  // Creation + persistence
  // ---------------------------------------------------------------------------

  it('creates a team and records the creator as the first member', async () => {
    const res = await http().post(base).set(auth(creatorToken)).send(createBody()).expect(201);
    teamId = res.body.id;
    expect(res.body.maxMembers).toBe(3);
    expect(res.body.memberCount).toBe(1);
    expect(res.body.openSlotCount).toBe(2);
    expect(res.body.professorId).toBe(professorA.id);
    expect(res.body.scope).toBe(TeamScope.SECTION);
    expect(res.body.contactValue).toBe('p51_handle');
    const slot1 = res.body.slots.find((s: { position: number }) => s.position === 1);
    expect(slot1.state).toBe('JOINED');
    expect(slot1.memberId).toBe(creator.id);
    slot2Id = res.body.slots.find((s: { position: number }) => s.position === 2).id;
    slot3Id = res.body.slots.find((s: { position: number }) => s.position === 3).id;
  }, SLOW);

  it('rejects a second team for the same subject and term (one-team rule)', async () => {
    const res = await http().post(base).set(auth(creatorToken)).send(createBody()).expect(409);
    expect(res.body.message).toMatch(/already belong/i);
    // And no partial second team was left behind.
    const count = await teamsRepo.count({ where: { creatorId: creator.id } });
    expect(count).toBe(1);
  });

  it('persists the team across a fresh read (refresh)', async () => {
    const res = await http().get(`${base}/${teamId}`).set(auth(creatorToken)).expect(200);
    expect(res.body.id).toBe(teamId);
    expect(res.body.slots).toHaveLength(3);
  });

  it('serves the caller state endpoint with a planning sectionId', async () => {
    // Regression: `mine` accepts the optional sectionId the mobile client sends.
    const res = await http()
      .get(`${base}/mine?subjectId=${subject.id}&semesterId=${semester.id}&sectionId=${sectionA.id}`)
      .set(auth(creatorToken))
      .expect(200);
    expect(res.body.team.id).toBe(teamId);
    expect(res.body.membershipSlotId).not.toBeNull();
    expect(res.body.hasEligibleSection).toBe(true);
  }, SLOW);

  // ---------------------------------------------------------------------------
  // Scope + visibility
  // ---------------------------------------------------------------------------

  it('shows a same-section team only to students in that section', async () => {
    // Creator (section A) sees it.
    const own = await http()
      .get(`${base}?subjectId=${subject.id}&semesterId=${semester.id}`)
      .set(auth(creatorToken))
      .expect(200);
    expect(own.body.data.map((t: { id: string }) => t.id)).toContain(teamId);

    // Joiner is in section B (same professor) — a SECTION-scope team is not visible.
    const other = await http()
      .get(`${base}?subjectId=${subject.id}&semesterId=${semester.id}&sectionId=${sectionB.id}`)
      .set(auth(joinerToken))
      .expect(200);
    expect(other.body.data.map((t: { id: string }) => t.id)).not.toContain(teamId);
  });

  it('excludes a different professor (student enrolled with professor B cannot see it)', async () => {
    const res = await http()
      .get(`${base}?subjectId=${subject.id}&semesterId=${semester.id}`)
      .set(auth(strangerToken))
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('does not disclose the contact value to an ineligible student', async () => {
    const res = await http()
      .get(`${base}/${teamId}`)
      .set(auth(strangerToken));
    // Either 404 or a body with no contact value — never the secret.
    if (res.status === 200) {
      expect(res.body.contactValue).toBeNull();
    } else {
      expect([403, 404]).toContain(res.status);
    }
    expect(JSON.stringify(res.body)).not.toContain('p51_handle');
  });

  // ---------------------------------------------------------------------------
  // Join request → accept
  // ---------------------------------------------------------------------------

  let requestId = '';

  it('lets an eligible student in the same section request a specific open slot', async () => {
    // Move a same-section, same-professor peer in: reuse `stranger` membership by
    // enrolling a fourth context is unnecessary — instead the creator's own
    // section peer is simulated by re-enrolling `joiner` into section A.
    await enrollmentsRepo.update({ studentId: joiner.id }, { sectionId: sectionA.id });

    const res = await http()
      .post(`${base}/${teamId}/join-requests`)
      .set(auth(joinerToken))
      .send({ slotId: slot2Id, message: 'P51-E2E please' })
      .expect(201);
    requestId = res.body.id;
    expect(res.body.status).toBe('PENDING');
    expect(res.body.slotId).toBe(slot2Id);

    // Pending ≠ accepted: still exactly one member.
    const team = await teamsRepo.findOne({ where: { id: teamId } });
    expect(team).not.toBeNull();
    expect(await membershipsRepo.count({ where: { teamId } })).toBe(1);
  });

  it('rejects duplicate / competing requests from the same student for the term', async () => {
    await http()
      .post(`${base}/${teamId}/join-requests`)
      .set(auth(joinerToken))
      .send({ slotId: slot2Id })
      .expect(409);
  });

  it("only the creator can see and decide the team's join requests", async () => {
    await http().get(`${base}/${teamId}/join-requests`).set(auth(joinerToken)).expect(403);
    await http().get(`${base}/${teamId}/join-requests`).set(auth(creatorToken)).expect(200);
    await http()
      .patch(`${base}/${teamId}/join-requests/${requestId}`)
      .set(auth(joinerToken))
      .send({ approve: true })
      .expect(403);
  });

  it('accepts the request and places the student in exactly the requested slot', async () => {
    const res = await http()
      .patch(`${base}/${teamId}/join-requests/${requestId}`)
      .set(auth(creatorToken))
      .send({ approve: true })
      .expect(200);
    expect(res.body.status).toBe('APPROVED');

    const detail = await http().get(`${base}/${teamId}`).set(auth(creatorToken)).expect(200);
    const slot2 = detail.body.slots.find((s: { id: string }) => s.id === slot2Id);
    expect(slot2.state).toBe('JOINED');
    expect(slot2.memberId).toBe(joiner.id);
    expect(detail.body.memberCount).toBe(2);

    // The accepted member now sees the contact value; the ineligible one does not.
    const asMember = await http().get(`${base}/${teamId}`).set(auth(joinerToken)).expect(200);
    expect(asMember.body.contactValue).toBe('p51_handle');
  }, SLOW);

  it('now blocks the accepted member from another team in the same subject/term', async () => {
    await http().post(base).set(auth(joinerToken)).send(createBody({ sectionId: sectionA.id, name: 'P51-E2E Dup' })).expect(409);
  });

  // ---------------------------------------------------------------------------
  // Rejection path
  // ---------------------------------------------------------------------------

  it('lets the creator reject a request without recording membership', async () => {
    // Enroll the third student into the team's section so they become eligible.
    await enrollmentsRepo.update({ studentId: stranger.id }, { sectionId: sectionA.id });
    const req = await http()
      .post(`${base}/${teamId}/join-requests`)
      .set(auth(strangerToken))
      .send({ slotId: slot3Id })
      .expect(201);
    const rejectRes = await http()
      .patch(`${base}/${teamId}/join-requests/${req.body.id}`)
      .set(auth(creatorToken))
      .send({ approve: false })
      .expect(200);
    expect(rejectRes.body.status).toBe('REJECTED');
    expect(await membershipsRepo.count({ where: { teamId } })).toBe(2);
  }, SLOW);

  it('allows a previously rejected student to request again (partial unique index)', async () => {
    const res = await http()
      .post(`${base}/${teamId}/join-requests`)
      .set(auth(strangerToken))
      .send({ slotId: slot3Id })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
  }, SLOW);

  // ---------------------------------------------------------------------------
  // Capacity
  // ---------------------------------------------------------------------------

  it('never lets acceptance exceed the team capacity', async () => {
    // Fill the last slot via the pending request from `stranger`.
    const pending = await http()
      .get(`${base}/${teamId}/join-requests?status=PENDING`)
      .set(auth(creatorToken))
      .expect(200);
    const last = pending.body[0];
    await http()
      .patch(`${base}/${teamId}/join-requests/${last.id}`)
      .set(auth(creatorToken))
      .send({ approve: true })
      .expect(200);

    const detail = await http().get(`${base}/${teamId}`).set(auth(creatorToken)).expect(200);
    expect(detail.body.memberCount).toBe(3);
    expect(detail.body.openSlotCount).toBe(0);
  }, SLOW);

  // ---------------------------------------------------------------------------
  // Admin surface
  // ---------------------------------------------------------------------------

  it('refuses the admin surface to students', async () => {
    await http().get('/api/v1/teams/admin').set(auth(creatorToken)).expect(403);
    await http().get('/api/v1/teams/admin/count').set(auth(creatorToken)).expect(403);
    await http().get('/api/v1/teams/admin/stats').set(auth(creatorToken)).expect(403);
    await http().get('/api/v1/teams/admin').expect(401);
  });

  it('returns a database-derived global team count to the admin', async () => {
    const res = await http().get('/api/v1/teams/admin/count').set(auth(adminToken)).expect(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const dbCount = await teamsRepo.count();
    expect(res.body.total).toBe(dbCount);
  });

  it('lists teams for the admin with pagination metadata independent of the page', async () => {
    const res = await http().get('/api/v1/teams/admin?limit=1&page=1').set(auth(adminToken)).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    // The total is not the page length.
    expect(res.body.meta.total).toBeGreaterThanOrEqual(res.body.data.length);
    expect(res.body.meta.total).toBe(await teamsRepo.count());
  });

  it('filters the admin list by term and never leaks contact values', async () => {
    const res = await http()
      .get(`/api/v1/teams/admin?semesterId=${semester.id}`)
      .set(auth(adminToken))
      .expect(200);
    const ids = res.body.data.map((t: { id: string }) => t.id);
    expect(ids).toContain(teamId);
    for (const t of res.body.data) {
      expect(t).not.toHaveProperty('contactValue');
    }
    expect(JSON.stringify(res.body)).not.toContain('p51_handle');

    const none = await http()
      .get('/api/v1/teams/admin?semesterId=00000000-0000-4000-8000-000000000000')
      .set(auth(adminToken))
      .expect(200);
    expect(none.body.data).toHaveLength(0);
    expect(none.body.meta.total).toBe(0);
  });

  it('rejects an invalid admin filter with 400', async () => {
    await http().get('/api/v1/teams/admin?semesterId=not-a-uuid').set(auth(adminToken)).expect(400);
    await http().get('/api/v1/teams/admin?scope=NOPE').set(auth(adminToken)).expect(400);
    await http().get('/api/v1/teams/admin?limit=1000').set(auth(adminToken)).expect(400);
  });

  it('returns aggregate stats including the global team count', async () => {
    const res = await http().get('/api/v1/teams/admin/stats').set(auth(adminToken)).expect(200);
    expect(res.body.totalTeams).toBe(await teamsRepo.count());
    expect(res.body.totalMembers).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // Team deletion + membership (creator only)
  // ---------------------------------------------------------------------------

  it('refuses to let an ordinary member delete the team', async () => {
    // `joiner` is an accepted member of the team, not its creator.
    await http().delete(`${base}/${teamId}`).set(auth(joinerToken)).expect(403);
    // The team and its members are untouched.
    expect(await teamsRepo.count({ where: { id: teamId } })).toBe(1);
    expect(await membershipsRepo.count({ where: { teamId } })).toBe(3);
  });

  it('refuses to let an unrelated student delete the team', async () => {
    await http().delete(`${base}/${teamId}`).set(auth(strangerToken)).expect(403);
    expect(await teamsRepo.count({ where: { id: teamId } })).toBe(1);
  });

  it('lets a member leave the team and releases their task slot', async () => {
    const before = await http().get(`${base}/${teamId}`).set(auth(creatorToken)).expect(200);
    expect(before.body.memberCount).toBe(3);

    await http().delete(`${base}/${teamId}/members/me`).set(auth(joinerToken)).expect(204);

    const after = await http().get(`${base}/${teamId}`).set(auth(creatorToken)).expect(200);
    expect(after.body.memberCount).toBe(2);
    // The freed task slot is open again for another student.
    const freed = after.body.slots.find(
      (s: { memberId: string | null; state: string }) => s.memberId === null && s.state === 'OPEN',
    );
    expect(freed).toBeTruthy();
    expect(await membershipsRepo.count({ where: { teamId, userId: joiner.id } })).toBe(0);
    // The team itself survives the departure.
    expect(await teamsRepo.count({ where: { id: teamId } })).toBe(1);
  }, SLOW);

  it('refuses to let the creator leave the team', async () => {
    await http().delete(`${base}/${teamId}/members/me`).set(auth(creatorToken)).expect(400);
    expect(await membershipsRepo.count({ where: { teamId, userId: creator.id } })).toBe(1);
  });

  it('lets the creator delete the team and removes every membership', async () => {
    await http().delete(`${base}/${teamId}`).set(auth(creatorToken)).expect(204);
    expect(await teamsRepo.count({ where: { id: teamId } })).toBe(0);
    expect(await membershipsRepo.count({ where: { teamId } })).toBe(0);
  }, SLOW);

  it('reports an already deleted team as not found', async () => {
    await http().delete(`${base}/${teamId}`).set(auth(creatorToken)).expect(404);
  });
});
