import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 2 (academic catalog): subject-code uniqueness moves from global to
 * specialization scope. Different specializations may teach distinct subjects
 * that share a code (e.g. "IT101" in two programs), so the global unique index
 * on subjects.code is replaced by a partial unique index on (programId, code).
 *
 * Safety: purely an index swap — no rows are inserted, updated, or deleted.
 * Existing data automatically satisfies the new constraint (globally unique
 * codes are a superset of per-program unique codes), so no backfill or manual
 * reconciliation is required. Program-less subjects (programId IS NULL, e.g.
 * after a program deletion via ON DELETE SET NULL) are excluded from the new
 * index; they are never part of any catalog or management scope.
 *
 * Reversal caveat: `down` restores the global unique index and will fail if
 * two programs were given the same subject code while this migration was
 * active; reconcile those rows manually before reverting.
 */
export class SubjectCodeProgramScope1792500000000 implements MigrationInterface {
    name = 'SubjectCodeProgramScope1792500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_542cbba74dde3c82ab49c57310"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subject_program_code" ON "subjects" ("programId", "code") WHERE "programId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_subject_program_code"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_542cbba74dde3c82ab49c57310" ON "subjects" ("code")`);
    }

}
