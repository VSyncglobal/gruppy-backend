-- CreateTable
CREATE TABLE "PoolFinance" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "baseCostPerUnit" DOUBLE PRECISION NOT NULL,
    "logisticCost" DOUBLE PRECISION DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION DEFAULT 0,
    "totalCost" DOUBLE PRECISION DEFAULT 0,
    "grossProfit" DOUBLE PRECISION DEFAULT 0,
    "platformFee" DOUBLE PRECISION DEFAULT 0.05,
    "platformEarning" DOUBLE PRECISION DEFAULT 0,
    "memberSavings" DOUBLE PRECISION DEFAULT 0,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolFinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEarnings" (
    "id" TEXT NOT NULL,
    "poolFinanceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEarnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolFinance_poolId_key" ON "PoolFinance"("poolId");

-- CreateIndex
CREATE INDEX "AdminEarnings_poolFinanceId_idx" ON "AdminEarnings"("poolFinanceId");

-- AddForeignKey
ALTER TABLE "PoolFinance" ADD CONSTRAINT "PoolFinance_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEarnings" ADD CONSTRAINT "AdminEarnings_poolFinanceId_fkey" FOREIGN KEY ("poolFinanceId") REFERENCES "PoolFinance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
