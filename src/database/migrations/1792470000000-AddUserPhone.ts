import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 1 (accounts): optional contact phone number on the user profile.
 * Purely additive — nullable column, no backfill, no destructive change.
 */
export class AddUserPhone1792470000000 implements MigrationInterface {
    name = 'AddUserPhone1792470000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    }

}
