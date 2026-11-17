/*
  Warnings:

  - You are about to drop the column `createdat` on the `wallets` table. All the data in the column will be lost.
  - You are about to drop the column `updatedat` on the `wallets` table. All the data in the column will be lost.
  - You are about to drop the column `userid` on the `wallets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wallets" DROP COLUMN "createdat",
DROP COLUMN "updatedat",
DROP COLUMN "userid",
ADD COLUMN     "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency" VARCHAR(10) DEFAULT 'NGN',
ADD COLUMN     "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" VARCHAR(255);
