/*
  Store wallet balances as whole kobo (BIGINT) instead of naira (DECIMAL(10,2)).

  - `balance` is renamed to `balanceKobo` rather than dropped, so existing balances are kept.
  - Existing values are converted from naira to kobo (x100), e.g. 50.00 -> 5000.
  - `balanceKobo` and `currency` become NOT NULL; any NULLs are backfilled first.
*/

-- Rename balance (naira) -> balanceKobo, keeping the data
ALTER TABLE "wallets" RENAME COLUMN "balance" TO "balanceKobo";

-- Old default (0.00 naira) is dropped before the type change and replaced below
ALTER TABLE "wallets" ALTER COLUMN "balanceKobo" DROP DEFAULT;

UPDATE "wallets" SET "balanceKobo" = 0 WHERE "balanceKobo" IS NULL;

-- Naira -> kobo, rounded to the nearest kobo
ALTER TABLE "wallets" ALTER COLUMN "balanceKobo" SET DATA TYPE BIGINT USING ROUND("balanceKobo" * 100)::BIGINT;

ALTER TABLE "wallets" ALTER COLUMN "balanceKobo" SET DEFAULT 0;

ALTER TABLE "wallets" ALTER COLUMN "balanceKobo" SET NOT NULL;

-- Currency must always be set
UPDATE "wallets" SET "currency" = 'NGN' WHERE "currency" IS NULL;

ALTER TABLE "wallets" ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(255);
