// src/hooks/poolFinanceHooks.ts
import prisma from "../utils/prismaClient";
import { GlobalSetting } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * A helper function to convert the GlobalSetting array into a usable object
 */
const getSettings = (settings: GlobalSetting[]) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    PLATFORM_FEE_RATE: settingsMap.get("PLATFORM_FEE_RATE") || 0.05,
    // Add other rates as needed
  };
};

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
  logger.info(`FINANCE HOOK: Updating finance for Pool ID: ${poolId}...`);

  try {
    // 1. Fetch all necessary data for calculation within the transaction
    const [pool, finance, globalSettings] = await Promise.all([
      tx.pool.findUniqueOrThrow({
        where: { id: poolId },
      }),
      tx.poolFinance.findUniqueOrThrow({
        where: { poolId: poolId },
      }),
      tx.globalSetting.findMany({
        where: { key: { in: ["PLATFORM_FEE_RATE"] } },
      }),
    ]);

    const settings = getSettings(globalSettings);

    // 2. Perform all financial calculations using the pre-calculated costs
    // N = current number of members in the pool
    const N = pool.currentQuantity;

    // These values were pre-calculated and stored during pool creation
    const totalFixedCosts = finance.totalFixedCosts || 0;
    const totalVariableCostPerUnit = finance.totalVariableCostPerUnit || 0;
    const benchmarkPricePerUnit = finance.benchmarkPricePerUnit || 0;

    // Calculate total cost for N members
    const totalLandedCost = totalFixedCosts + (totalVariableCostPerUnit * N);
    
    // Calculate total revenue for N members
    const totalRevenue = pool.pricePerUnit * N;

    // Calculate profit (Revenue - Cost)
    const grossProfit = totalRevenue - totalLandedCost;

    // Calculate platform earning based on the profit
    const platformEarning = grossProfit > 0 ? grossProfit * settings.PLATFORM_FEE_RATE : 0;

    // Calculate member savings (Benchmark Price - Selling Price)
    const totalBenchmarkPrice = benchmarkPricePerUnit * N;
    const memberSavings = totalBenchmarkPrice > totalRevenue ? totalBenchmarkPrice - totalRevenue : 0;

    // 3. Update the PoolFinance record with the new real-time values
    await tx.poolFinance.update({
      where: { poolId: pool.id },
      data: {
        totalRevenue: totalRevenue,
        totalCost: totalLandedCost,
        grossProfit: grossProfit,
        platformEarning: platformEarning,
        memberSavings: memberSavings,
        // Update legacy fields for compatibility (if needed)
        platformFee: settings.PLATFORM_FEE_RATE,
        logisticCost: totalFixedCosts, // Store fixed costs here for reference
      },
    });

    logger.info(`FINANCE HOOK: Successfully updated finance for Pool ID: ${poolId}`);

  } catch (error: any) {
    logger.error(`FINANCE HOOK: Error updating finance for pool ${poolId}:`, error);
    Sentry.captureException(error, { extra: { poolId, context: "updatePoolFinance Hook" } });
    // Re-throw the error to fail the parent transaction
    throw error;
  }
}