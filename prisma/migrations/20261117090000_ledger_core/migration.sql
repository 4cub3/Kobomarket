-- Ledger core: wallets become double-entry accounts; adds transactions,
-- ledger_entries and idempotency_keys.
--
-- Rules the database enforces by itself, so a bug in the code can't break them:
--   * amounts are BIGINT kobo, and entry/transaction amounts must be > 0
--   * user and platform balances can never go below zero (only EXTERNAL can)
--   * ledger_entries are append-only (UPDATE and DELETE raise an error)
--   * every transaction's debits equal its credits (checked at COMMIT)
--   * a transaction can be reversed at most once (unique reverses_transaction_id)

-- CreateEnum
CREATE TYPE "account_owner_type" AS ENUM ('USER', 'SYSTEM', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'FROZEN');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('FUNDING', 'ORDER_PAYMENT', 'ESCROW_RELEASE', 'REFUND', 'PAYOUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "entry_direction" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- -----------------------------------------------------------------------------
-- wallets -> accounts. Existing user wallets are kept, not dropped.
-- -----------------------------------------------------------------------------

-- Wallets created before the switch to UUIDs still have ids like '1'. Nothing
-- references wallet ids yet, so they can safely get new UUIDs before the type change.
UPDATE "wallets" SET "id" = gen_random_uuid()::text
WHERE "id" !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

ALTER TABLE "wallets" RENAME TO "accounts";
ALTER TABLE "accounts" RENAME CONSTRAINT "wallets_pkey" TO "accounts_pkey";
DROP INDEX "wallets_userId_key";

ALTER TABLE "accounts" RENAME COLUMN "userId" TO "owner_id";
ALTER TABLE "accounts" RENAME COLUMN "balanceKobo" TO "balance_kobo";
ALTER TABLE "accounts" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "accounts" RENAME COLUMN "updatedAt" TO "updated_at";

UPDATE "accounts" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "accounts" SET "updated_at" = CURRENT_TIMESTAMP WHERE "updated_at" IS NULL;

ALTER TABLE "accounts"
    ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "owner_id" SET DATA TYPE VARCHAR(64),
    ALTER COLUMN "currency" SET DATA TYPE VARCHAR(3),
    ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6) USING "created_at"::timestamptz,
    ALTER COLUMN "created_at" SET NOT NULL,
    ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6) USING "updated_at"::timestamptz,
    ALTER COLUMN "updated_at" SET NOT NULL,
    ADD COLUMN "owner_type" "account_owner_type" NOT NULL DEFAULT 'USER',
    ADD COLUMN "status" "account_status" NOT NULL DEFAULT 'ACTIVE';

-- The default only labelled the existing wallets; new rows must say who owns them
ALTER TABLE "accounts" ALTER COLUMN "owner_type" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_owner_type_owner_id_currency_key" ON "accounts"("owner_type", "owner_id", "currency");

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_balance_not_negative" CHECK ("owner_type" = 'EXTERNAL' OR "balance_kobo" >= 0),
    ADD CONSTRAINT "accounts_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

-- Platform accounts (the code looks them up by owner_id). PAYSTACK is the
-- outside world: funding debits it, so its balance goes negative and always
-- equals -(money funded - money paid out). That keeps funding double-entry.
INSERT INTO "accounts" ("owner_type", "owner_id", "currency") VALUES
    ('SYSTEM', 'PLATFORM_ESCROW', 'NGN'),
    ('SYSTEM', 'PLATFORM_REVENUE', 'NGN'),
    ('SYSTEM', 'PLATFORM_PAYOUT_CLEARING', 'NGN'),
    ('EXTERNAL', 'PAYSTACK', 'NGN');

-- -----------------------------------------------------------------------------
-- transactions
-- -----------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" VARCHAR(100) NOT NULL,
    "type" "transaction_type" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'PENDING',
    "amount_kobo" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "idempotency_key" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "reverses_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transactions_amount_positive" CHECK ("amount_kobo" > 0),
    CONSTRAINT "transactions_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reverses_transaction_id_key" ON "transactions"("reverses_transaction_id");

-- CreateIndex
CREATE INDEX "transactions_type_status_created_at_idx" ON "transactions"("type", "status", "created_at");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- -----------------------------------------------------------------------------
-- ledger_entries
-- -----------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "entry_direction" NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "balance_after_kobo" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount_kobo" > 0)
);

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_id_idx" ON "ledger_entries"("account_id", "id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Append-only: mistakes are fixed with a reversing transaction, never by editing rows
CREATE FUNCTION "ledger_entries_reject_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed (post a reversal instead)', TG_OP;
END;
$$;

CREATE TRIGGER "ledger_entries_append_only"
    BEFORE UPDATE OR DELETE ON "ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION "ledger_entries_reject_change"();

-- Debits must equal credits for every transaction. The trigger is DEFERRED, so it
-- runs at COMMIT, after all of the transaction's entries have been inserted.
CREATE FUNCTION "ledger_entries_check_balanced"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    difference NUMERIC;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount_kobo" ELSE -"amount_kobo" END), 0)
    INTO difference
    FROM "ledger_entries"
    WHERE "transaction_id" = NEW."transaction_id";

    IF difference <> 0 THEN
        RAISE EXCEPTION 'transaction % is unbalanced: debits - credits = % kobo', NEW."transaction_id", difference;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
    AFTER INSERT ON "ledger_entries"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "ledger_entries_check_balanced"();

-- -----------------------------------------------------------------------------
-- idempotency_keys
-- -----------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(64) NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_scope_key_key" ON "idempotency_keys"("user_id", "scope", "key");
