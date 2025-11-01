// src/jobs/finalizeReadyPools.ts
import prisma from "../utils/prismaClient";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // --- THIS IS THE FIX ---

export async function finalizeReadyPools() {
  logger.info("Running job: finalizeReadyPools...");

  const poolsToFinalize = await prisma.pool.findMany({
    where: {
      status: PoolStatus.CLOSED, // Find pools that are full but not yet financially finalized
      finance: {
        isFinalized: false,
      },
    },
  });

  logger.info(`Found ${poolsToFinalize.length} pools to finalize.`);

  for (const pool of poolsToFinalize) {
    try {
      await prisma.$transaction(async (tx) => {
        // --- MODIFIED: Call the new, fast finance hook ---
        await updatePoolFinance(tx, pool.id);

        // After calculation, mark as finalized
        await tx.poolFinance.update({
          where: { poolId: pool.id },
          data: {
            isFinalized: true,
            finalizedAt: new Date(),
          },
        });
      });

      logger.info(`Successfully finalized pool ${pool.id}`);
    } catch (error: any) {
      logger.error(`Error finalizing pool ${pool.id}:`, error);
      Sentry.captureException(error, { extra: { poolId: pool.id, context: "finalizeReadyPools" }});
    }
  }
  logger.info("Job: finalizeReadyPools finished.");
}