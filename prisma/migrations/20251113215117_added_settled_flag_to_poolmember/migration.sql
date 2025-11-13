-- DropForeignKey
ALTER TABLE "public"."BulkOrder" DROP CONSTRAINT "BulkOrder_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FailedJoinAttempt" DROP CONSTRAINT "FailedJoinAttempt_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FailedJoinAttempt" DROP CONSTRAINT "FailedJoinAttempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PoolMember" DROP CONSTRAINT "PoolMember_userId_fkey";

-- AlterTable
ALTER TABLE "PoolMember" ADD COLUMN     "isSettled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PoolMember_isSettled_idx" ON "PoolMember"("isSettled");

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedJoinAttempt" ADD CONSTRAINT "FailedJoinAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedJoinAttempt" ADD CONSTRAINT "FailedJoinAttempt_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
