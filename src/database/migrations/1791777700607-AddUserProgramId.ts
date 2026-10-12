import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProgramId1791777700607 implements MigrationInterface {
    name = 'AddUserProgramId1791777700607'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "programId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_users_program_id" ON "users"  ("programId") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_edaf44538bef67012ac990c5ac4" FOREIGN KEY ("programId") REFERENCES "academic_programs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_edaf44538bef67012ac990c5ac4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_program_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "programId"`);
    }

}
