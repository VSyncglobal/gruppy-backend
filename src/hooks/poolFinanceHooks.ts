import prisma from "../utils/prismaClient";

/**
 * 🔁 Update pool finance after every join
 */
export async function updatePoolFinance(poolId: string) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { product: true, finance: true },
  });

  if (!pool) return;

  const finance = await prisma.poolFinance.findUnique({ where: { poolId } });
  if (!finance) return;

  const totalRevenue = pool.pricePerUnit * pool.currentQuantity;
  const totalCost =
    (finance.baseCostPerUnit + (finance.logisticCost || 0)) *
    pool.currentQuantity;
  const grossProfit = totalRevenue - totalCost;

  const platformEarning = grossProfit * (finance.platformFee || 0.05);
  const memberSavings = grossProfit * 0.1; // Members get 10% back as pooled discount

  await prisma.poolFinance.update({
    where: { poolId },
    data: {
      totalRevenue,
      totalCost,
      grossProfit,
      platformEarning,
      memberSavings,
      updatedAt: new Date(),
    },
  });
}
