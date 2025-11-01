// src/jobs/cleanupPendingPayments.ts
import prisma from "../utils/prismaClient";
import { DeletionEntityType, PaymentStatus } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // --- THIS IS THE FIX ---

const PAYMENT_WINDOW_MINUTES = 30;

export const cleanupPendingPayments = async () => {
  logger.info(`JOB: Running cleanup for pending payments older than ${PAYMENT_WINDOW_MINUTES} minutes...`);

  const expirationTime = new Date(Date.now() - PAYMENT_WINDOW_MINUTES * 60 * 1000);

  const expiredPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      createdAt: { lte: expirationTime },
      poolMember: { isNot: null }, // Only find payments linked to a pool member
    },
    include: {
      poolMember: {
        include: {
          user: { select: { id: true, email: true } },
          pool: { select: { id: true, pricePerUnit: true, targetQuantity: true } } // --- UPDATED: Added targetQuantity ---
        },
      },
    },
  });

  if (expiredPayments.length === 0) {
    logger.info("JOB: No expired pending payments found.");
    return;
  }

  logger.warn(`JOB: Found ${expiredPayments.length} expired payments to clean up.`);

  for (const payment of expiredPayments) {
    if (!payment.poolMember || !payment.poolMember.pool) continue; // Added null check for pool

    const poolId = payment.poolMember.poolId;
    const memberId = payment.poolMember.id;
    const quantityToRemove = payment.poolMember.quantity;
    const userEmail = payment.poolMember.user.email;
    const valueToRemove = payment.poolMember.pool.pricePerUnit * quantityToRemove;
    
    // Calculate progress decrement (ensure no division by zero)
    const targetQuantity = payment.poolMember.pool.targetQuantity;
    const progressDecrement = targetQuantity > 0 ? (quantityToRemove / targetQuantity) * 100 : 0;

    try {
      await prisma.$transaction(async (tx) => {
        // Log the deletions first
        await tx.deletionLog.createMany({
          data: [
            {
              entityType: DeletionEntityType.PAYMENT,
              entityId: payment.id,
              reason: "Expired pending payment for pool member.",
              metadata: { poolId, userEmail },
            },
            {
              entityType: DeletionEntityType.POOL_MEMBER,
              entityId: memberId,
              reason: "Associated payment expired.",
              metadata: { poolId, userEmail },
            },
          ],
        });

        // Perform the updates and deletions
        await tx.pool.update({
          where: { id: poolId },
          data: { 
            currentQuantity: { decrement: quantityToRemove },
            cumulativeValue: { decrement: valueToRemove },
            progress: { decrement: progressDecrement }
          },
        });

        // Deleting the PoolMember will cascade and delete the Payment
        // This is because PoolMember has a required relation to Payment (paymentId is unique)
        // Let's delete the payment first to be safe, then the member.
        await tx.payment.delete({ where: { id: payment.id } });
        await tx.poolMember.delete({ where: { id: memberId } });


        // Call the finance hook
        await updatePoolFinance(tx, poolId);
      });

      logger.info(`JOB: Successfully cleaned up and logged deletion for payment ${payment.id}.`);
    } catch (error: any) {
      logger.error(`JOB: Failed to clean up payment ${payment.id}. Error:`, error);
      Sentry.captureException(error, { extra: { paymentId: payment.id, context: "cleanupPendingPayments" }});
    }
  }
};