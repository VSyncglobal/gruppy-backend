// src/hooks/poolFinanceHooks.ts
import prisma from "../utils/prismaClient";
import {
  GlobalSetting,
  Payment,
  PaymentStatus,
  PoolStatus,
  Prisma,
  PaymentMethod,
} from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Define the Prisma Transaction Client type
type PrismaTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * A helper function to convert the GlobalSetting array into a usable object
 * (Unchanged)
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
 * (Unchanged)
 * @param tx - The Prisma transaction client passed from the parent function.
 * @param poolId - The ID of the pool whose finances need to be recalculated.
 */
export async function updatePoolFinance(tx: PrismaTx, poolId: string) {
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
    const N = pool.currentQuantity;
    const totalFixedCosts = finance.totalFixedCosts || 0;
    const totalVariableCostPerUnit = finance.totalVariableCostPerUnit || 0;
    const benchmarkPricePerUnit = finance.benchmarkPricePerUnit || 0;

    const totalLandedCost = totalFixedCosts + totalVariableCostPerUnit * N;
    const totalRevenue = pool.pricePerUnit * N;
    const grossProfit = totalRevenue - totalLandedCost;
    const platformEarning =
      grossProfit > 0 ? grossProfit * settings.PLATFORM_FEE_RATE : 0;
    const totalBenchmarkPrice = benchmarkPricePerUnit * N;
    const memberSavings =
      totalBenchmarkPrice > totalRevenue
        ? totalBenchmarkPrice - totalRevenue
        : 0;

    // 3. Update the PoolFinance record with the new real-time values
    await tx.poolFinance.update({
      where: { poolId: pool.id },
      data: {
        totalRevenue: totalRevenue,
        totalCost: totalLandedCost,
        grossProfit: grossProfit,
        platformEarning: platformEarning,
        memberSavings: memberSavings,
        platformFee: settings.PLATFORM_FEE_RATE,
        logisticCost: totalFixedCosts,
      },
    });

    logger.info(
      `FINANCE HOOK: Successfully updated finance for Pool ID: ${poolId}`
    );
  } catch (error: any) {
    logger.error(
      `FINANCE HOOK: Error updating finance for pool ${poolId}:`,
      error
    );
    Sentry.captureException(error, {
      extra: { poolId, context: "updatePoolFinance Hook" },
    });
    // Re-throw the error to fail the parent transaction
    throw error;
  }
}

/**
 * --- MODIFIED (Concern 9) ---
 * This is the central function for settling a join.
 * It updates the pool's quantity and then calls updatePoolFinance.
 * This is called *after* 100% of payment is confirmed.
 * It is now idempotent and will not run twice for the same member.
 */
export async function triggerPoolSettlement(
  tx: PrismaTx,
  poolMemberId: string | null // Can be null if payment is not linked
) {
  if (!poolMemberId) {
    logger.warn(
      `SETTLEMENT: Triggered with null poolMemberId. Skipping pool update.`
    );
    return;
  }

  logger.info(`SETTLEMENT: Triggered for PoolMember ID: ${poolMemberId}`);
  try {
    const poolMember = await tx.poolMember.findUniqueOrThrow({
      where: { id: poolMemberId },
      include: { pool: true },
    });

    // --- IDEMPOTENCY FIX (Concern 9) ---
    // Check if this member has already been settled.
    // This prevents race conditions (e.g., a webhook firing twice).
    if (poolMember.isSettled) {
      logger.warn(
        `SETTLEMENT: PoolMember ID: ${poolMemberId} is already settled. Skipping duplicate execution.`
      );
      return; // Already done, just exit gracefully.
    }
    // --- END OF FIX ---

    const pool = poolMember.pool;
    const quantityToAdd = poolMember.quantity;

    // 1. Update the Pool's quantity and status
    const newQuantity = pool.currentQuantity + quantityToAdd;
    const newStatus =
      newQuantity >= pool.targetQuantity ? PoolStatus.CLOSED : pool.status;
    const newProgress = (newQuantity / pool.targetQuantity) * 100;
    const newCumulativeValue = newQuantity * pool.pricePerUnit;

    // --- MODIFIED (Concern 9): Update pool and member in parallel ---
    const [updatedPool, _] = await Promise.all([
      // A. Update the Pool
      tx.pool.update({
        where: { id: pool.id },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
          progress: newProgress,
          cumulativeValue: newCumulativeValue,
        },
      }),
      // B. Mark the PoolMember as settled
      tx.poolMember.update({
        where: { id: poolMember.id },
        data: { isSettled: true },
      }),
    ]);
    // --- END OF MODIFICATION ---

    // 2. Call the finance hook to recalculate all financials
    await updatePoolFinance(tx, pool.id);

    if (updatedPool.status === PoolStatus.CLOSED) {
      logger.info(
        `SETTLEMENT: Pool ${pool.id} has been filled by member ${poolMember.id} and is now CLOSED.`
      );
    }
  } catch (error: any) {
    logger.error(
      `SETTLEMENT: Failed for PoolMember ID: ${poolMemberId}:`,
      error
    );
    Sentry.captureException(error, {
      extra: { poolMemberId, context: "triggerPoolSettlement" },
    });
    throw new Error(`Failed to settle pool member: ${error.message}`);
  }
}

/**
 * --- NEW (v_phase1) ---
 * Logs a failed, expired, or overridden join attempt to the audit table.
 * This is called *before* the failed PoolMember/Payment records are deleted.
 */
export async function logFailedJoinAttempt(
  tx: PrismaTx,
  data: {
    reason: string;
    userId: string;
    poolId: string;
    quantity: number;
    payments: Payment[]; // Pass in the associated payments
  }
) {
  try {
    const { reason, userId, poolId, quantity, payments } = data;

    // Calculate totals from the payment records
    const totalAmount = payments.reduce(
      (sum, p) => sum + p.amount + p.amountFromBalance,
      0
    );
    const deliveryFee = payments.reduce((sum, p) => sum + p.deliveryFee, 0);
    const amountFromBalance = payments.reduce(
      (sum, p) => sum + p.amountFromBalance,
      0
    );

    // Find the relevant error metadata
    const failedPayment = payments.find(
      (p) => p.status !== PaymentStatus.SUCCESS
    );

    await tx.failedJoinAttempt.create({
      data: {
        reason: reason,
        userId: userId,
        poolId: poolId,
        quantity: quantity,
        totalAmount: totalAmount,
        deliveryFee: deliveryFee,
        amountFromBalance: amountFromBalance,
        paymentMethod:
          failedPayment?.method || PaymentMethod.ACCOUNT_BALANCE, // This line is now fixed
        providerMetadata:
          (failedPayment?.metadata as Prisma.InputJsonValue) || undefined,
      },
    });
  } catch (error: any) {
    logger.error(`AUDIT: Failed to log failed join attempt:`, error);
    Sentry.captureException(error, {
      extra: { data, context: "logFailedJoinAttempt" },
    });
    // We re-throw to fail the parent transaction
    throw new Error(`Failed to log audit data: ${error.message}`);
  }
}