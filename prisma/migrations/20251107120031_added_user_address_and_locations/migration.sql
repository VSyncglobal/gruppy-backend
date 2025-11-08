/*
  Warnings:

  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `User` table. All the data in the column will be lost.
  - Made the column `categoryId` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PLANNING', 'LOCKED', 'IN_TRANSIT', 'ARRIVED', 'CLEARED');

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- AlterTable
ALTER TABLE "LogisticsRoute" ADD COLUMN     "capacityCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "capacityKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "shipmentId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "volumeCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "address",
DROP COLUMN "location",
ADD COLUMN     "accountBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KenyanTown" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "county" TEXT NOT NULL,

    CONSTRAINT "KenyanTown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRate" (
    "id" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "ratePerKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logisticsRouteId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PLANNING',
    "totalCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAddress_userId_idx" ON "UserAddress"("userId");

-- CreateIndex
CREATE INDEX "KenyanTown_county_idx" ON "KenyanTown"("county");

-- CreateIndex
CREATE UNIQUE INDEX "KenyanTown_name_county_key" ON "KenyanTown"("name", "county");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRate_county_key" ON "DeliveryRate"("county");

-- CreateIndex
CREATE INDEX "Pool_shipmentId_idx" ON "Pool"("shipmentId");

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_logisticsRouteId_fkey" FOREIGN KEY ("logisticsRouteId") REFERENCES "LogisticsRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
