import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AccountStatus, UserRole } from '../src/common/enums.js';
import { getValidatedJwtConfig } from '../src/config/jwt.util.js';
import { AcademicProgram } from '../src/programs/entities/program.entity.js';
import { Subject } from '../src/subjects/entities/subject.entity.js';
import { SubjectManagerAssignment } from '../src/users/entities/subject-manager-assignment.entity.js';
import { User } from '../src/users/entities/user.entity.js';

/**
 * Integration coverage for the academic assignment endpoints
 * (Phase 4: roles + authorization foundation).
 *
 * Uses the shared dev PostgreSQL. All fixtures are created and removed
 * within this suite; existing data is never modified.
 */
describe('Academic assignments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  let users: Repository<User>;
  let programs: Repository<AcademicProgram>;
  let subjects: Repository<Subject>;
  let assignments: Repository<SubjectManagerAssignment>;

  let admin: User;
  let student: User;
  let otherStudent: User;
  let programA: AcademicProgram;
  let programB: AcademicProgram;
  let subjectA: Subject;
  let subjectB: Subject;

  let adminToken: string;
  let studentToken: string;

  const freshId = () => crypto.randomUUID();

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
    users = dataSource.getRepository(User);
    programs = dataSource.getRepository(AcademicProgram);
    subjects = dataSource.getRepository(Subject);
    assignments = dataSource.getRepository(SubjectManagerAssignment);

    jwt = new JwtService({
      secret: getValidatedJwtConfig(app.get(ConfigService)).secret,
    });

    const suffix = freshId().slice(0, 8);
    programA = await programs.save(
      programs.create({ name: `E2E Program A ${suffix}`, code: `E2EA_${suffix}` }),
    );
    programB = await programs.save(
      programs.create({ name: `E2E Program B ${suffix}`, code: `E2EB_${suffix}` }),
    );
    subjectA = await subjects.save(
      subjects.create({
        code: `E2EA_${suffix}`,
        nameEn: `E2E Subject A ${suffix}`,
        nameAr: `مادة E2E أ ${suffix}`,
        creditHours: 3,
        programId: programA.id,
        isActive: true,
      }),
    );
    subjectB = await subjects.save(
      subjects.create({
        code: `E2EB_${suffix}`,
        nameEn: `E2E Subject B ${suffix}`,
        nameAr: `مادة E2E ب ${suffix}`,
        creditHours: 3,
        programId: programB.id,
        isActive: true,
      }),
    );

    const makeUser = (fullName: string, email: string, programId: string | null) =>
      users.save(
        users.create({
          fullName,
          email,
          passwordHash: `e2e-hash-${freshId()}`,
          role: UserRole.STUDENT,
          status: AccountStatus.ACTIVE,
          programId,
        }),
      );

    admin = await users.save(
      users.create({
        fullName: 'E2E Admin',
        email: `e2e.admin.${suffix}@studygo.example`,
        passwordHash: `e2e-hash-${freshId()}`,
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
        programId: null,
      }),
    );
    student = await makeUser('E2E Student A', `e2e.a.${suffix}@studygo.example`, programA.id);
    otherStudent = await makeUser('E2E Student B', `e2e.b.${suffix}@studygo.example`, programA.id);

    adminToken = await jwt.signAsync({ sub: admin.id, email: admin.email, role: UserRole.ADMIN });
    studentToken = await jwt.signAsync({ sub: student.id, email: student.email, role: UserRole.STUDENT });
  });

  afterAll(async () => {
    await assignments.delete({ userId: student.id });
    await subjects.remove([subjectB, subjectA]);
    await users.remove([otherStudent, student, admin]);
    await programs.remove([programB, programA]);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('requires authentication on every academic-assignment route', async () => {
    const base = `/api/v1/users/${student.id}/academic-assignments`;
    await http().get(base).expect(401);
    await http().put(`${base}/program-manager`).send({ programId: subjectA.id }).expect(401);
    await http().delete(`${base}/program-manager`).expect(401);
    await http().put(`${base}/subject-manager`).send({ subjectIds: [] }).expect(401);
    await http().delete(`${base}/subject-manager/${subjectA.id}`).expect(401);
  });

  it('forbids non-admin roles from every academic-assignment route', async () => {
    const base = `/api/v1/users/${student.id}/academic-assignments`;
    await http().get(base).set(auth(studentToken)).expect(403);
    await http().put(`${base}/program-manager`).set(auth(studentToken)).send({ programId: subjectA.id }).expect(403);
    await http().delete(`${base}/program-manager`).set(auth(studentToken)).expect(403);
    await http().put(`${base}/subject-manager`).set(auth(studentToken)).send({ subjectIds: [] }).expect(403);
    await http().delete(`${base}/subject-manager/${subjectA.id}`).set(auth(studentToken)).expect(403);
  });

  it('rejects an unknown target user with 404', async () => {
    const id404 = freshId();
    await http().get(`/api/v1/users/${id404}/academic-assignments`).set(auth(adminToken)).expect(404);
  });

  it('returns the scope of a plain student (read-only)', async () => {
    const res = await http()
      .get(`/api/v1/users/${student.id}/academic-assignments`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.role).toBe(UserRole.STUDENT);
    expect(res.body.programId).toBe(programA.id);
    expect(res.body.managedProgramId).toBeNull();
    expect(res.body.managedSubjectIds).toEqual([]);
  });

  it('rejects assigning a nonexistent program with 404', async () => {
    await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/program-manager`)
      .set(auth(adminToken))
      .send({ programId: freshId() })
      .expect(404);
  });

  it('promotes a student to Program Manager of their program', async () => {
    const res = await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/program-manager`)
      .set(auth(adminToken))
      .send({ programId: programA.id })
      .expect(200);
    expect(res.body.role).toBe(UserRole.PROGRAM_MANAGER);
    expect(res.body.programId).toBe(programA.id);
    expect(res.body.managedProgramId).toBe(programA.id);
    expect(res.body.managedSubjectIds).toEqual([]);
  });

  it('assigns subjects to a Subject Manager within their own program', async () => {
    const res = await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [subjectA.id] })
      .expect(200);
    expect(res.body.role).toBe(UserRole.SUBJECT_MANAGER);
    expect(res.body.managedSubjectIds).toEqual([subjectA.id]);
  });

  it('rejects subjects outside the user program (cross-program, atomic)', async () => {
    const res = await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [subjectB.id] })
      .expect(400);
    expect(res.body.message).toBeDefined();
    const after = await http()
      .get(`/api/v1/users/${student.id}/academic-assignments`)
      .set(auth(adminToken))
      .expect(200);
    expect(after.body.role).toBe(UserRole.SUBJECT_MANAGER);
    expect(after.body.managedSubjectIds).toEqual([subjectA.id]);
  });

  it('rejects a subject id that does not exist with 400 and writes nothing', async () => {
    await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [freshId()] })
      .expect(400);
    const after = await http()
      .get(`/api/v1/users/${student.id}/academic-assignments`)
      .set(auth(adminToken))
      .expect(200);
    expect(after.body.managedSubjectIds).toEqual([subjectA.id]);
  });

  it('rejects duplicate subject ids as invalid input', async () => {
    await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [subjectA.id, subjectA.id] })
      .expect(400);
  });

  it('an empty replacement list withdraws Subject Manager access', async () => {
    const res = await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [] })
      .expect(200);
    expect(res.body.role).toBe(UserRole.STUDENT);
    expect(res.body.managedSubjectIds).toEqual([]);
  });

  it('deleting a single subject assignment works', async () => {
    await http()
      .put(`/api/v1/users/${student.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: [subjectA.id] })
      .expect(200);
    const res = await http()
      .delete(`/api/v1/users/${student.id}/academic-assignments/subject-manager/${subjectA.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.managedSubjectIds).toEqual([]);
  });

  it('removing the program-manager assignment clears the scope', async () => {
    const res = await http()
      .delete(`/api/v1/users/${student.id}/academic-assignments/program-manager`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.role).toBe(UserRole.STUDENT);
    expect(res.body.managedProgramId).toBeNull();
  });

  it('validates the request body shape', async () => {
    await http()
      .put(`/api/v1/users/${otherStudent.id}/academic-assignments/program-manager`)
      .set(auth(adminToken))
      .send({ programId: 'not-a-uuid' })
      .expect(400);
    await http()
      .put(`/api/v1/users/${otherStudent.id}/academic-assignments/subject-manager`)
      .set(auth(adminToken))
      .send({ subjectIds: ['not-a-uuid'] })
      .expect(400);
  });

  it('never touches other users', async () => {
    const res = await http()
      .get(`/api/v1/users/${otherStudent.id}/academic-assignments`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.role).toBe(UserRole.STUDENT);
    expect(res.body.managedSubjectIds).toEqual([]);
    expect(res.body.managedProgramId).toBeNull();
  });
});