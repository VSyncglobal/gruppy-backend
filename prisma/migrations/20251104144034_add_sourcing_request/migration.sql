-- CreateEnum
CREATE TYPE "SourcingStatus" AS ENUM ('PENDING', 'RESEARCHING', 'SOURCED', 'REJECTED');

-- CreateTable
CREATE TABLE "SourcingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "status" "SourcingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "hsCode" TEXT,
    "basePrice" DOUBLE PRECISION,
    "benchmarkPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingRequest_userId_idx" ON "SourcingRequest"("userId");

-- CreateIndex
CREATE INDEX "SourcingRequest_status_idx" ON "SourcingRequest"("status");

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
