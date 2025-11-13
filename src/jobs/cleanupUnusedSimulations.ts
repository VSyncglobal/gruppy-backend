// src/jobs/cleanupUnusedSimulations.ts
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * Deletes simulation logs (PricingRequest) that are older than 7 days
 * AND were never linked to a created pool.
 */
export async function cleanupUnusedSimulations() {
  logger.info("JOB: Running cleanup for unused simulation logs...");

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.pricingRequest.deleteMany({
      where: {
        // The record is older than 7 days
        createdAt: { lt: sevenDaysAgo },
        // AND it has no pool linked to it
        pools: { none: {} },
      },
    });

    if (result.count > 0) {
      logger.info(`JOB: Successfully deleted ${result.count} unused simulation logs.`);
    } else {
      logger.info("JOB: No unused simulation logs to delete.");
    }
  } catch (error: any) {
    logger.error("JOB: Error cleaning up unused simulations:", error);
    // --- THIS IS THE FIX ---
    Sentry.captureException(error, { 
      extra: { jobName: "cleanupUnusedSimulations" } 
    });
    // --- END OF FIX ---
  }
}