/*
  Warnings:

  - You are about to drop the column `total` on the `PricingLog` table. All the data in the column will be lost.
  - Added the required column `finalPrice` to the `PricingLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PricingLog" DROP COLUMN "total",
ADD COLUMN     "finalPrice" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "PriceCalculationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCalculationLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PriceCalculationLog" ADD CONSTRAINT "PriceCalculationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
