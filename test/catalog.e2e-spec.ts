import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AccountStatus, DeliveryMode, SemesterStatus, UserRole, Weekday } from '../src/common/enums.js';
import { getValidatedJwtConfig } from '../src/config/jwt.util.js';
import { Professor } from '../src/professors/entities/professor.entity.js';
import { AcademicProgram } from '../src/programs/entities/program.entity.js';
import { SectionSchedule } from '../src/sections/entities/section-schedule.entity.js';
import { AcademicSection } from '../src/sections/entities/section.entity.js';
import { Semester } from '../src/semesters/entities/semester.entity.js';
import { Subject } from '../src/subjects/entities/subject.entity.js';
import { User } from '../src/users/entities/user.entity.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Integration coverage for the program-scoped catalog sync endpoint
 * (Phase 7). Uses the shared dev PostgreSQL; every fixture is created and
 * removed within this suite and existing data is never modified.
 */
describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  let users: Repository<User>;
  let programs: Repository<AcademicProgram>;
  let subjects: Repository<Subject>;
  let semesters: Repository<Semester>;
  let professors: Repository<Professor>;
  let sections: Repository<AcademicSection>;
  let schedules: Repository<SectionSchedule>;

  let programA: AcademicProgram;
  let programB: AcademicProgram;
  let subjectA: Subject;
  let subjectInactive: Subject;
  let subjectB: Subject;
  let semesterA: Semester;
  let semesterB: Semester;
  let professorA: Professor;
  let sectionA: AcademicSection;
  let sectionCrossSubject: AcademicSection;
  let sectionCrossSemester: AcademicSection;
  let sectionInactive: AcademicSection;
  let scheduleA: SectionSchedule;

  let studentA: User;
  let studentNoProgram: User;
  let studentAToken: string;
  let studentNoProgramToken: string;

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
    semesters = dataSource.getRepository(Semester);
    professors = dataSource.getRepository(Professor);
    sections = dataSource.getRepository(AcademicSection);
    schedules = dataSource.getRepository(SectionSchedule);

    jwt = new JwtService({ secret: getValidatedJwtConfig(app.get(ConfigService)).secret });

    const suffix = freshId().slice(0, 8);
    programA = await programs.save(
      programs.create({ name: `E2E Catalog A ${suffix}`, code: `E2ECA_${suffix}` }),
    );
    programB = await programs.save(
      programs.create({ name: `E2E Catalog B ${suffix}`, code: `E2ECB_${suffix}` }),
    );

    subjectA = await subjects.save(
      subjects.create({
        code: `E2ECA1_${suffix}`,
        nameEn: `Catalog Subject A ${suffix}`,
        nameAr: `مادة أ ${suffix}`,
        creditHours: 3,
        programId: programA.id,
        isActive: true,
      }),
    );
    subjectInactive = await subjects.save(
      subjects.create({
        code: `E2ECA2_${suffix}`,
        nameEn: `Catalog Subject A Inactive ${suffix}`,
        nameAr: `مادة أ معطلة ${suffix}`,
        creditHours: 3,
        programId: programA.id,
        isActive: false,
      }),
    );
    subjectB = await subjects.save(
      subjects.create({
        code: `E2ECB1_${suffix}`,
        nameEn: `Catalog Subject B ${suffix}`,
        nameAr: `مادة ب ${suffix}`,
        creditHours: 3,
        programId: programB.id,
        isActive: true,
      }),
    );

    semesterA = await semesters.save(
      semesters.create({
        programId: programA.id,
        name: `Term A ${suffix}`,
        code: `SA_${suffix}`,
        status: SemesterStatus.ACTIVE,
      }),
    );
    semesterB = await semesters.save(
      semesters.create({
        programId: programB.id,
        name: `Term B ${suffix}`,
        code: `SB_${suffix}`,
        status: SemesterStatus.ACTIVE,
      }),
    );

    professorA = await professors.save(
      professors.create({ name: `Prof A ${suffix}`, email: `prof.a.${suffix}@studygo.example` }),
    );

    sectionA = await sections.save(
      sections.create({
        semesterId: semesterA.id,
        subjectId: subjectA.id,
        professorId: professorA.id,
        code: `01`,
        deliveryMode: DeliveryMode.ON_CAMPUS,
        capacity: 40,
        isActive: true,
      }),
    );
    sectionCrossSubject = await sections.save(
      sections.create({
        semesterId: semesterA.id,
        subjectId: subjectB.id,
        professorId: professorA.id,
        code: `02`,
        isActive: true,
      }),
    );
    sectionCrossSemester = await sections.save(
      sections.create({
        semesterId: semesterB.id,
        subjectId: subjectA.id,
        professorId: professorA.id,
        code: `03`,
        isActive: true,
      }),
    );
    sectionInactive = await sections.save(
      sections.create({
        semesterId: semesterA.id,
        subjectId: subjectA.id,
        professorId: professorA.id,
        code: `04`,
        isActive: false,
      }),
    );

    scheduleA = await schedules.save(
      schedules.create({
        sectionId: sectionA.id,
        dayOfWeek: Weekday.SUNDAY,
        startTime: '09:00:00',
        endTime: '10:30:00',
        room: `R ${suffix}`,
      }),
    );

    studentA = await users.save(
      users.create({
        fullName: 'E2E Catalog Student',
        email: `e2e.catalog.${suffix}@studygo.example`,
        passwordHash: `e2e-hash-${freshId()}`,
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
        programId: programA.id,
      }),
    );
    studentNoProgram = await users.save(
      users.create({
        fullName: 'E2E Catalog Student No Program',
        email: `e2e.catalog.none.${suffix}@studygo.example`,
        passwordHash: `e2e-hash-${freshId()}`,
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
        programId: null,
      }),
    );

    studentAToken = await jwt.signAsync({
      sub: studentA.id,
      email: studentA.email,
      role: UserRole.STUDENT,
    });
    studentNoProgramToken = await jwt.signAsync({
      sub: studentNoProgram.id,
      email: studentNoProgram.email,
      role: UserRole.STUDENT,
    });
  }, 30000);

  afterAll(async () => {
    await schedules.remove([scheduleA]);
    await sections.remove([sectionInactive, sectionCrossSemester, sectionCrossSubject, sectionA]);
    await subjects.remove([subjectInactive, subjectB, subjectA]);
    await semesters.remove([semesterB, semesterA]);
    await professors.remove([professorA]);
    await users.remove([studentNoProgram, studentA]);
    await programs.remove([programB, programA]);
    await app.close();
  }, 30000);

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('requires authentication', async () => {
    await http().get('/api/v1/catalog').expect(401);
  });

  it("returns only the caller's program catalog with canonical ids and correct relationships", async () => {
    const res = await http().get('/api/v1/catalog').set(auth(studentAToken)).expect(200);
    const body = res.body;

    expect(body.program).toEqual({
      id: programA.id,
      name: programA.name,
      code: programA.code,
    });

    expect(body.semesters.map((s: { id: string }) => s.id)).toEqual([semesterA.id]);
    expect(body.semesters[0].programId).toBe(programA.id);

    const subjectIds = body.subjects.map((s: { id: string }) => s.id);
    expect(subjectIds).toEqual([subjectA.id]);
    expect(body.subjects[0].programId).toBe(programA.id);
    expect(Array.isArray(body.subjects[0].prerequisiteIds)).toBe(true);

    expect(body.sections.map((s: { id: string }) => s.id)).toEqual([sectionA.id]);
    expect(body.sections[0].subjectId).toBe(subjectA.id);
    expect(body.sections[0].semesterId).toBe(semesterA.id);
    expect(body.sections[0].professorId).toBe(professorA.id);

    expect(body.professors.map((p: { id: string }) => p.id)).toEqual([professorA.id]);

    expect(body.schedules.map((s: { id: string }) => s.id)).toEqual([scheduleA.id]);
    expect(body.schedules[0].sectionId).toBe(sectionA.id);
  });

  it('never leaks another program, an inactive record, or a cross-program offering', async () => {
    const res = await http().get('/api/v1/catalog').set(auth(studentAToken)).expect(200);
    const subjectIds = res.body.subjects.map((s: { id: string }) => s.id);
    const sectionIds = res.body.sections.map((s: { id: string }) => s.id);

    expect(subjectIds).not.toContain(subjectB.id);
    expect(subjectIds).not.toContain(subjectInactive.id);
    expect(res.body.semesters.map((s: { id: string }) => s.id)).not.toContain(semesterB.id);
    expect(sectionIds).not.toContain(sectionCrossSubject.id);
    expect(sectionIds).not.toContain(sectionCrossSemester.id);
    expect(sectionIds).not.toContain(sectionInactive.id);
  });

  it('returns canonical UUIDs throughout', async () => {
    const res = await http().get('/api/v1/catalog').set(auth(studentAToken)).expect(200);
    expect(res.body.program.id).toMatch(UUID_RE);
    expect(res.body.sections[0].id).toMatch(UUID_RE);
    expect(res.body.schedules[0].id).toMatch(UUID_RE);
  });

  it('returns an empty catalog for a user without a program', async () => {
    const res = await http()
      .get('/api/v1/catalog')
      .set(auth(studentNoProgramToken))
      .expect(200);
    expect(res.body).toEqual({
      program: null,
      semesters: [],
      subjects: [],
      professors: [],
      sections: [],
      schedules: [],
    });
  });
});
