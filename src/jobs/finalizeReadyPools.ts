// src/jobs/finalizeReadyPools.ts
import prisma from "../utils/prismaClient";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";
import {
  PoolStatus,
  BulkOrderStatus, // --- NEW (v_phase1): Import new enum
  PrismaClient, // --- NEW (v_phase1): Import type
} from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Define the Prisma Transaction Client type
type PrismaTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * --- REWRITTEN (v_phase1) ---
 * This job now finds pools that have passed their deadline and closes them,
 * finalizes their finances, and creates the admin's BulkOrder.
 */
export async function finalizeReadyPools() {
  logger.info("Running job: finalizeReadyPools...");
  const now = new Date();

  // --- MODIFIED (v_phase1): Find pools that need to be closed
  const poolsToClose = await prisma.pool.findMany({
    where: {
      status: PoolStatus.FILLING, // Find pools that are still open
      deadline: { lte: now }, // But whose deadline has passed
      currentQuantity: { gt: 0 }, // And at least one person joined
      bulkOrder: null, // And a bulk order has not been created yet
    },
    include: {
      finance: true,
      product: true, // Need product for basePrice
    },
  });

  if (poolsToClose.length === 0) {
    logger.info("Job: finalizeReadyPools finished. No pools to close.");
    return;
  }

  logger.info(`Found ${poolsToClose.length} pools to close and finalize.`);

  // Get exchange rate once
  const usdRateSetting = await prisma.globalSetting.findUnique({
    where: { key: "USD_TO_KES_RATE" },
  });
  const exchangeRate = parseFloat(usdRateSetting?.value || "130.0"); // Default fallback

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
        // 1. Call finance hook one last time to ensure all calcs are final
        await updatePoolFinance(tx, pool.id);

        // 2. Get the *finalized* finance data
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

        // 5. --- NEW (v_phase1): Create the Admin's BulkOrder ---
        
        // Calculate costs for the BulkOrder
        // These are based on the final, settled state of the pool
        const totalLogisticsCostKES = finalizedFinance.totalFixedCosts || 0;
        const totalVariableCostKES =
          (finalizedFinance.totalVariableCostPerUnit || 0) *
          pool.currentQuantity;
        
        // This is the total cost for the admin to buy the goods
        const totalOrderCostKES = totalLogisticsCostKES + totalVariableCostKES;
        
        // This is the supplier's price in USD
        const costPerItemUSD = pool.product.basePrice; 
        
        // We cannot calculate totalTaxesKES as it's not stored separately
        // in PoolFinance. We log 0 as a placeholder.
        
        await tx.bulkOrder.create({
          data: {
            poolId: pool.id,
            status: BulkOrderStatus.PENDING_SUPPLIER_PAYMENT,
            totalLogisticsCostKES: totalLogisticsCostKES,
            totalOrderCostKES: totalOrderCostKES,
            costPerItemUSD: costPerItemUSD,
            exchangeRate: exchangeRate,
            totalTaxesKES: 0, // This data is not available in PoolFinance
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