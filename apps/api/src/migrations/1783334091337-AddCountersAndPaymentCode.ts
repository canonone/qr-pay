import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCountersAndPaymentCode1783334091337 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "counters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "counter_name" character varying NOT NULL,
        "merchant_label" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_counters_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN "payment_code" character varying,
      ADD COLUMN "counter_id" uuid REFERENCES "counters" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN "payment_code",
      DROP COLUMN "counter_id"
    `);

    await queryRunner.query(`DROP TABLE "counters"`);
  }
}
