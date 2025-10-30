-- CreateEnum
CREATE TYPE "DeletionEntityType" AS ENUM ('PAYMENT', 'POOL_MEMBER');

-- CreateTable
CREATE TABLE "DeletionLog" (
    "id" TEXT NOT NULL,
    "entityType" "DeletionEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletionLog_entityType_entityId_idx" ON "DeletionLog"("entityType", "entityId");
