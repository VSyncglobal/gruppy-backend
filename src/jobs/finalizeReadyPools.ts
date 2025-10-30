// src/jobs/finalizeReadyPools.ts
import prisma from "../utils/prismaClient";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";

export async function finalizeReadyPools() {
  logger.info("Running job: finalizeReadyPools...");

  const poolsToFinalize = await prisma.pool.findMany({
    where: {
      status: PoolStatus.CLOSED,
      finance: {
        isFinalized: false,
      },
    },
  });

  logger.info(`Found ${poolsToFinalize.length} pools to finalize.`);

  for (const pool of poolsToFinalize) {
    try {
      // ✅ FIX: We must wrap the call in a transaction
      // so we can pass the 'tx' object to the hook.
      await prisma.$transaction(async (tx) => {
        // ✅ Pass 'tx' as the first argument and 'pool.id' as the second.
        await updatePoolFinance(tx, pool.id);
      });

      logger.info(`Successfully finalized pool ${pool.id}`);
    } catch (error) {
      logger.error(`Error finalizing pool ${pool.id}:`, error);
    }
  }
  logger.info("Job: finalizeReadyPools finished.");
}