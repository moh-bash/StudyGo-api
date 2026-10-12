import { MigrationInterface, QueryRunner } from "typeorm";

export class AcademicRoles1791798594481 implements MigrationInterface {
    name = 'AcademicRoles1791798594481'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "subject_manager_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "subjectId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_subject_manager_user_subject" UNIQUE ("userId", "subjectId"), CONSTRAINT "PK_f23d6b85baff7a680278338a202" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_subject_manager_assignments_user_id" ON "subject_manager_assignments"  ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_subject_manager_assignments_subject_id" ON "subject_manager_assignments"  ("subjectId") `);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE 'PROGRAM_MANAGER'`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE 'SUBJECT_MANAGER'`);
        await queryRunner.query(`ALTER TABLE "subject_manager_assignments" ADD CONSTRAINT "FK_9ada71b03e0c2116db51a9f5a35" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subject_manager_assignments" ADD CONSTRAINT "FK_312cfb342812f1898c94513ee79" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subject_manager_assignments" DROP CONSTRAINT "FK_312cfb342812f1898c94513ee79"`);
        await queryRunner.query(`ALTER TABLE "subject_manager_assignments" DROP CONSTRAINT "FK_9ada71b03e0c2116db51a9f5a35"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum_old" AS ENUM('STUDENT', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING "role"::"text"::"public"."users_role_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_subject_manager_assignments_subject_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_subject_manager_assignments_user_id"`);
        await queryRunner.query(`DROP TABLE "subject_manager_assignments"`);
    }

}
