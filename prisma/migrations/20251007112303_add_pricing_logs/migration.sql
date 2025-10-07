-- CreateTable
CREATE TABLE "PricingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PricingLog" ADD CONSTRAINT "PricingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
