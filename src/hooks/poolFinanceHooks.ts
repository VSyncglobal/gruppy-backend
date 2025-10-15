import prisma from "../utils/prismaClient";

/**
 * Calculates and updates the financial metrics for a given pool.
 * This function is designed to be called from within a Prisma transaction.
 * @param tx - The Prisma transaction client passed from the parent function.
 * @param poolId - The ID of the pool whose finances need to be recalculated.
 */
export async function updatePoolFinance(
  tx: Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  poolId: string
) {
  // 1. Fetch all necessary data for calculation within the transaction
  const pool = await tx.pool.findUnique({
    where: { id: poolId },
    include: {
      product: true, // Needed for the base cost
    },
  });

  if (!pool) {
    throw new Error(`Pool with ID ${poolId} not found during finance update.`);
  }

  // Define business logic constants
  const LOGISTIC_COST_PER_UNIT = 5.0; // Example placeholder for shipping/handling per item
  const PLATFORM_FEE_RATE = 0.05; // 5% platform fee on gross profit

  // 2. Perform all financial calculations
  const totalRevenue = pool.pricePerUnit * pool.currentQuantity;
  const totalBaseCost = pool.product.basePrice * pool.currentQuantity;
  const totalLogisticCost = LOGISTIC_COST_PER_UNIT * pool.currentQuantity;
  const totalCost = totalBaseCost + totalLogisticCost;
  const grossProfit = totalRevenue - totalCost;
  const platformEarning = grossProfit > 0 ? grossProfit * PLATFORM_FEE_RATE : 0;
  // Example savings calculation, can be made more complex later
  const memberSavings = grossProfit > 0 ? grossProfit * 0.1 : 0; 

  // 3. Use `upsert` to create or update the PoolFinance record
  // This is more robust than separate find/update calls
  await tx.poolFinance.upsert({
    where: { poolId: pool.id },
    update: {
      totalRevenue,
      totalCost,
      grossProfit,
      platformEarning,
      memberSavings,
    },
    create: {
      poolId: pool.id,
      baseCostPerUnit: pool.product.basePrice,
      logisticCost: LOGISTIC_COST_PER_UNIT,
      platformFee: PLATFORM_FEE_RATE,
      totalRevenue,
      totalCost,
      grossProfit,
      platformEarning,
      memberSavings,
    },
  });

  console.log(`FINANCE HOOK: Successfully updated finance for Pool ID: ${poolId}`);
}