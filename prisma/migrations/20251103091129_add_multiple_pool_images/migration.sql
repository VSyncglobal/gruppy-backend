/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Pool` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pool" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[];
