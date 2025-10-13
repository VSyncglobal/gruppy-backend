-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "cumulativeValue" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "profitMargin" DOUBLE PRECISION,
ADD COLUMN     "progress" DOUBLE PRECISION DEFAULT 0;

-- CreateIndex
CREATE INDEX "Pool_status_idx" ON "Pool"("status");

-- CreateIndex
CREATE INDEX "Pool_createdById_idx" ON "Pool"("createdById");

-- CreateIndex
CREATE INDEX "Pool_productId_idx" ON "Pool"("productId");
