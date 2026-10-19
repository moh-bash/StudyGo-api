import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 3 (grading weights): new subjects default to 25% project / 75% exam.
 *
 * Purely additive and non-destructive: only the column DEFAULT changes. Existing
 * rows keep their current weights (nothing is rewritten), and the
 * CHK_subject_weights_total / CHK_subject_weights_non_negative constraints are
 * untouched (25 + 75 = 100 still satisfies them). The service also applies this
 * default in code when a create request omits both weights, so this migration
 * only aligns the raw database default used by direct SQL inserts.
 */
export class SubjectWeightDefaults1792510000000 implements MigrationInterface {
    name = 'SubjectWeightDefaults1792510000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "projectWeight" SET DEFAULT 25`);
        await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "examWeight" SET DEFAULT 75`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "projectWeight" SET DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "subjects" ALTER COLUMN "examWeight" SET DEFAULT 100`);
    }

}
