/*
  Warnings:

  - You are about to drop the column `orderId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `PoolMember` table. All the data in the column will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderStatusHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BulkOrderStatus" AS ENUM ('PENDING_SUPPLIER_PAYMENT', 'ORDERED', 'SHIPPED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ACCOUNT_BALANCE';

-- DropForeignKey
ALTER TABLE "public"."AdminEarnings" DROP CONSTRAINT "AdminEarnings_poolFinanceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Affiliate" DROP CONSTRAINT "Affiliate_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PoolFinance" DROP CONSTRAINT "PoolFinance_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PoolMember" DROP CONSTRAINT "PoolMember_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PoolMember" DROP CONSTRAINT "PoolMember_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Subcategory" DROP CONSTRAINT "Subcategory_categoryId_fkey";

-- DropIndex
DROP INDEX "public"."Payment_orderId_idx";

-- DropIndex
DROP INDEX "public"."PoolMember_paymentId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "orderId",
ADD COLUMN     "amountFromBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "poolMemberId" TEXT;

-- AlterTable
ALTER TABLE "PoolMember" DROP COLUMN "paymentId";

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "arrivalDate" TIMESTAMP(3),
ADD COLUMN     "departureDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- DropTable
DROP TABLE "public"."Order";

-- DropTable
DROP TABLE "public"."OrderStatusHistory";

-- DropEnum
DROP TYPE "public"."OrderStatus";

-- CreateTable
CREATE TABLE "BulkOrder" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "status" "BulkOrderStatus" NOT NULL DEFAULT 'PENDING_SUPPLIER_PAYMENT',
    "totalOrderCostKES" DOUBLE PRECISION NOT NULL,
    "totalLogisticsCostKES" DOUBLE PRECISION NOT NULL,
    "totalTaxesKES" DOUBLE PRECISION NOT NULL,
    "costPerItemUSD" DOUBLE PRECISION NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedJoinAttempt" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL,
    "amountFromBalance" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedJoinAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkOrder_poolId_key" ON "BulkOrder"("poolId");

-- CreateIndex
CREATE INDEX "FailedJoinAttempt_userId_idx" ON "FailedJoinAttempt"("userId");

-- CreateIndex
CREATE INDEX "FailedJoinAttempt_poolId_idx" ON "FailedJoinAttempt"("poolId");

-- CreateIndex
CREATE INDEX "Payment_poolMemberId_idx" ON "Payment"("poolMemberId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_poolMemberId_fkey" FOREIGN KEY ("poolMemberId") REFERENCES "PoolMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedJoinAttempt" ADD CONSTRAINT "FailedJoinAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedJoinAttempt" ADD CONSTRAINT "FailedJoinAttempt_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolFinance" ADD CONSTRAINT "PoolFinance_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEarnings" ADD CONSTRAINT "AdminEarnings_poolFinanceId_fkey" FOREIGN KEY ("poolFinanceId") REFERENCES "PoolFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
