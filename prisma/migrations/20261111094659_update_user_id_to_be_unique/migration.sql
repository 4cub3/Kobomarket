/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `wallets` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `wallets` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DEFAULT 0.00,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");
