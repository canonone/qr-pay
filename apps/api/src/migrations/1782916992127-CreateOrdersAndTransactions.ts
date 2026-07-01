import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersAndTransactions1782916992127 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_ref" character varying NOT NULL,
        "amount_expected" numeric(12,2) NOT NULL,
        "amount_paid" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'pending',
        "virtual_account_number" character varying,
        "virtual_account_name" character varying,
        "bank_name" character varying,
        "account_ref" character varying NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_merchant_ref" UNIQUE ("merchant_ref"),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nomba_transaction_id" character varying NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "type" character varying NOT NULL DEFAULT 'payment',
        "sender_name" character varying,
        "sender_account_number" character varying,
        "sender_bank_code" character varying,
        "sender_bank_name" character varying,
        "raw_payload" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "order_id" uuid,
        CONSTRAINT "UQ_transactions_nomba_transaction_id" UNIQUE ("nomba_transaction_id"),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
