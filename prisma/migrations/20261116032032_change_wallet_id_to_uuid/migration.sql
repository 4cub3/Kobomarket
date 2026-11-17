/*
  Warnings:

  - The primary key for the `wallets` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "wallets_id_seq";
