/*
  Warnings:

  - The values [OPEN,FILLED,READY_TO_SHIP] on the enum `PoolStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[providerTransactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PoolStatus_new" AS ENUM ('FILLING', 'CLOSED', 'SHIPPING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED');
ALTER TABLE "public"."Pool" ALTEALTER TABLE "Pool" ALTER COLUMN "status" TYPE "PoolStatus_new" USING
  CASE "status"::text
    WHEN 'OPEN' THEN 'FILLING'
    WHEN 'FILLED' THEN 'CLOSED'
    WHEN 'READY_TO_SHIP' THEN 'SHIPPING'
    ELSE "status"::text::"PoolStatus_new"
  END;R COLUMN "status" DROP DEFAULT;
ALTER TABLE "Pool" ALTER COLUMN "status" TYPE "PoolStatus_new" USING ("status"::text::"PoolStatus_new");
ALTER TYPE "PoolStatus" RENAME TO "PoolStatus_old";
ALTER TYPE "PoolStatus_new" RENAME TO "PoolStatus";
DROP TYPE "public"."PoolStatus_old";
ALTER TABLE "Pool" ALTER COLUMN "status" SET DEFAULT 'FILLING';
COMMIT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "status" SET DEFAULT 'FILLING';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "subcategoryId" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "poolId" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Subcategory_categoryId_idx" ON "Subcategory"("categoryId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_poolId_idx" ON "Review"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
