// src/jobs/finalizeReadyPools.ts
import prisma from "../utils/prismaClient";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";
import { PoolStatus, BulkOrderStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export async function finalizeReadyPools() {
  logger.info("Running job: finalizeReadyPools...");
  const now = new Date();

  // Find pools that are still FILLING, past their deadline, and have members
  const poolsToClose = await prisma.pool.findMany({
    where: {
      status: PoolStatus.FILLING,
      deadline: { lte: now },
      currentQuantity: { gt: 0 },
      bulkOrder: null, // And a bulk order has not been created yet
    },
    include: {
      finance: true,
      product: true,
    },
  });

  if (poolsToClose.length === 0) {
    logger.info("Job: finalizeReadyPools finished. No pools to close.");
    return;
  }

  logger.info(`Found ${poolsToClose.length} pools to close and finalize.`);

  // --- MODIFIED (Fix 8): Added logging for fallback ---
  const usdRateSetting = await prisma.globalSetting.findUnique({
    where: { key: "USD_TO_KES_RATE" },
  });

  if (!usdRateSetting) {
    logger.warn("USD_TO_KES_RATE not found in settings. Using default: 130.0");
  }
  const exchangeRate = parseFloat(usdRateSetting?.value || "130.0");
  // --- END (Fix 8) ---

  for (const pool of poolsToClose) {
    if (!pool.finance || !pool.product) {
      logger.error(
        `Pool ${pool.id} is missing finance or product data. Skipping.`
      );
      Sentry.captureException(
        new Error(`Pool ${pool.id} missing finance/product data`),
        { extra: { poolId: pool.id } }
      );
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Call finance hook one last time
        await updatePoolFinance(tx, pool.id);

        // 2. Get the finalized finance data
        const finalizedFinance = await tx.poolFinance.findUniqueOrThrow({
          where: { poolId: pool.id },
        });

        // 3. Mark Pool as CLOSED
        await tx.pool.update({
          where: { id: pool.id },
          data: { status: PoolStatus.CLOSED },
        });

        // 4. Mark PoolFinance as FINALIZED
        await tx.poolFinance.update({
          where: { poolId: pool.id },
          data: {
            isFinalized: true,
            finalizedAt: now,
          },
        });

        // 5. Create the Admin's BulkOrder
        await tx.bulkOrder.create({
          data: {
            poolId: pool.id,
            status: BulkOrderStatus.PENDING_SUPPLIER_PAYMENT,
            totalLogisticsCostKES: finalizedFinance.totalFixedCosts || 0,
            totalOrderCostKES:
              (finalizedFinance.totalFixedCosts || 0) +
              (finalizedFinance.totalVariableCostPerUnit || 0) *
                pool.currentQuantity,
            costPerItemUSD: pool.product.basePrice,
            exchangeRate: exchangeRate,
            totalTaxesKES: 0, // This data is not available from PoolFinance
          },
        });

        logger.info(
          `Successfully finalized pool ${pool.id} and created BulkOrder.`
        );
      });
    } catch (error: any) {
      logger.error(`Error finalizing pool ${pool.id}:`, error);
      Sentry.captureException(error, {
        extra: { poolId: pool.id, context: "finalizeReadyPools" },
      });
    }
  }
  logger.info("Job: finalizeReadyPools finished.");
}