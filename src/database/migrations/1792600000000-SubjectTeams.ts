import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 — subject teams.
 *
 * Extends the pre-existing generic team tables with everything the subject-team
 * feature needs. **Purely additive**: every new column on an existing table is
 * nullable or has a default, no column is dropped or rewritten, and existing
 * rows keep working (they simply carry `NULL` term/professor/scope-dependent
 * values).
 *
 * Changes
 * -------
 * 1. `study_teams`: add `semesterId` (term), `professorId`, `scope`,
 *    `contactMethod`, `contactValue`, with supporting indexes and FKs
 *    (ON DELETE SET NULL — deleting a term/professor never cascades to teams).
 * 2. New table `team_task_slots` (one row per member slot, incl. the creator),
 *    with `UQ_team_slot_position` and a partial unique on `(teamId, memberId)`.
 * 3. `team_memberships`: add `slotId`, `subjectId`, `semesterId`, plus the
 *    partial unique `UQ_membership_user_subject_term` that enforces the
 *    "one team per subject and term" invariant at the database level.
 * 4. `team_join_requests`: add `slotId` (+ FK), denormalized `subjectId` /
 *    `semesterId`, and the partial unique indexes
 *    `UQ_pending_request_student_subject_term` and `UQ_pending_request_slot`.
 *
 * A new enum type is created for `TeamScope`; the contact method reuses an
 * inline enum column (no separate type) and the slot state likewise.
 */
export class SubjectTeams1792600000000 implements MigrationInterface {
  name = 'SubjectTeams1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- study_teams -------------------------------------------------------
    await queryRunner.query(`CREATE TYPE "public"."study_teams_scope_enum" AS ENUM('SECTION', 'PROFESSOR')`);
    await queryRunner.query(`CREATE TYPE "public"."study_teams_contact_method_enum" AS ENUM('WHATSAPP_PHONE', 'TELEGRAM', 'GROUP_LINK')`);

    await queryRunner.query(`ALTER TABLE "study_teams" ADD "semesterId" uuid`);
    await queryRunner.query(`ALTER TABLE "study_teams" ADD "professorId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "study_teams" ADD "scope" "public"."study_teams_scope_enum" NOT NULL DEFAULT 'SECTION'`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_teams" ADD "contactMethod" "public"."study_teams_contact_method_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "study_teams" ADD "contactValue" character varying(300)`);

    await queryRunner.query(`CREATE INDEX "IDX_team_semester" ON "study_teams" ("semesterId")`);
    await queryRunner.query(`CREATE INDEX "IDX_team_professor" ON "study_teams" ("professorId")`);
    await queryRunner.query(`CREATE INDEX "IDX_team_scope" ON "study_teams" ("scope")`);
    await queryRunner.query(
      `ALTER TABLE "study_teams" ADD CONSTRAINT "FK_team_semester" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_teams" ADD CONSTRAINT "FK_team_professor" FOREIGN KEY ("professorId") REFERENCES "professors"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- team_task_slots ---------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "public"."team_task_slots_state_enum" AS ENUM('OPEN', 'JOINED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_task_slots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teamId" uuid NOT NULL, "position" integer NOT NULL, "taskDescription" character varying(200) NOT NULL, "state" "public"."team_task_slots_state_enum" NOT NULL DEFAULT 'OPEN', "memberId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_team_task_slots" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_slot_team" ON "team_task_slots" ("teamId")`);
    await queryRunner.query(`CREATE INDEX "IDX_slot_state" ON "team_task_slots" ("state")`);
    await queryRunner.query(`CREATE INDEX "IDX_slot_member" ON "team_task_slots" ("memberId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_team_slot_position" ON "team_task_slots" ("teamId", "position")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_team_slot_member" ON "team_task_slots" ("teamId", "memberId") WHERE "memberId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_task_slots" ADD CONSTRAINT "FK_slot_team" FOREIGN KEY ("teamId") REFERENCES "study_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- team_memberships --------------------------------------------------
    await queryRunner.query(`ALTER TABLE "team_memberships" ADD "slotId" uuid`);
    await queryRunner.query(`ALTER TABLE "team_memberships" ADD "subjectId" uuid`);
    await queryRunner.query(`ALTER TABLE "team_memberships" ADD "semesterId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_membership_slot" ON "team_memberships" ("slotId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_membership_user_subject_term" ON "team_memberships" ("userId", "subjectId", "semesterId") WHERE "subjectId" IS NOT NULL AND "semesterId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_memberships" ADD CONSTRAINT "FK_membership_slot" FOREIGN KEY ("slotId") REFERENCES "team_task_slots"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- team_join_requests ------------------------------------------------
    await queryRunner.query(`ALTER TABLE "team_join_requests" ADD "slotId" uuid`);
    await queryRunner.query(`ALTER TABLE "team_join_requests" ADD "subjectId" uuid`);
    await queryRunner.query(`ALTER TABLE "team_join_requests" ADD "semesterId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_request_slot" ON "team_join_requests" ("slotId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pending_request_student_subject_term" ON "team_join_requests" ("studentId", "subjectId", "semesterId") WHERE "status" = 'PENDING' AND "subjectId" IS NOT NULL AND "semesterId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pending_request_slot" ON "team_join_requests" ("slotId") WHERE "status" = 'PENDING' AND "slotId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_join_requests" ADD CONSTRAINT "FK_request_slot" FOREIGN KEY ("slotId") REFERENCES "team_task_slots"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "team_join_requests" DROP CONSTRAINT "FK_request_slot"`);
    await queryRunner.query(`DROP INDEX "UQ_pending_request_slot"`);
    await queryRunner.query(`DROP INDEX "UQ_pending_request_student_subject_term"`);
    await queryRunner.query(`DROP INDEX "IDX_request_slot"`);
    await queryRunner.query(`ALTER TABLE "team_join_requests" DROP COLUMN "semesterId"`);
    await queryRunner.query(`ALTER TABLE "team_join_requests" DROP COLUMN "subjectId"`);
    await queryRunner.query(`ALTER TABLE "team_join_requests" DROP COLUMN "slotId"`);

    await queryRunner.query(`ALTER TABLE "team_memberships" DROP CONSTRAINT "FK_membership_slot"`);
    await queryRunner.query(`DROP INDEX "UQ_membership_user_subject_term"`);
    await queryRunner.query(`DROP INDEX "IDX_membership_slot"`);
    await queryRunner.query(`ALTER TABLE "team_memberships" DROP COLUMN "semesterId"`);
    await queryRunner.query(`ALTER TABLE "team_memberships" DROP COLUMN "subjectId"`);
    await queryRunner.query(`ALTER TABLE "team_memberships" DROP COLUMN "slotId"`);

    await queryRunner.query(`ALTER TABLE "team_task_slots" DROP CONSTRAINT "FK_slot_team"`);
    await queryRunner.query(`DROP INDEX "UQ_team_slot_member"`);
    await queryRunner.query(`DROP INDEX "UQ_team_slot_position"`);
    await queryRunner.query(`DROP INDEX "IDX_slot_member"`);
    await queryRunner.query(`DROP INDEX "IDX_slot_state"`);
    await queryRunner.query(`DROP INDEX "IDX_slot_team"`);
    await queryRunner.query(`DROP TABLE "team_task_slots"`);
    await queryRunner.query(`DROP TYPE "public"."team_task_slots_state_enum"`);

    await queryRunner.query(`ALTER TABLE "study_teams" DROP CONSTRAINT "FK_team_professor"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP CONSTRAINT "FK_team_semester"`);
    await queryRunner.query(`DROP INDEX "IDX_team_scope"`);
    await queryRunner.query(`DROP INDEX "IDX_team_professor"`);
    await queryRunner.query(`DROP INDEX "IDX_team_semester"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP COLUMN "contactValue"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP COLUMN "contactMethod"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP COLUMN "scope"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP COLUMN "professorId"`);
    await queryRunner.query(`ALTER TABLE "study_teams" DROP COLUMN "semesterId"`);
    await queryRunner.query(`DROP TYPE "public"."study_teams_contact_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."study_teams_scope_enum"`);
  }
}
