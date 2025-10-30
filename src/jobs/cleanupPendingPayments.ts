import prisma from "../utils/prismaClient";
import { DeletionEntityType, PaymentStatus } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";

const PAYMENT_WINDOW_MINUTES = 30;

export const cleanupPendingPayments = async () => {
  console.log(`JOB: Running cleanup for pending payments older than ${PAYMENT_WINDOW_MINUTES} minutes...`);

  const expirationTime = new Date(Date.now() - PAYMENT_WINDOW_MINUTES * 60 * 1000);

  const expiredPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      createdAt: { lte: expirationTime },
      poolMember: { isNot: null },
    },
    include: {
      poolMember: {
        include: {
          user: { select: { id: true, email: true } },
        },
      },
    },
  });

  if (expiredPayments.length === 0) {
    console.log("JOB: No expired pending payments found.");
    return;
  }

  for (const payment of expiredPayments) {
    if (!payment.poolMember) continue;

    const poolId = payment.poolMember.poolId;
    const memberId = payment.poolMember.id;
    const quantityToRemove = payment.poolMember.quantity;
    const userEmail = payment.poolMember.user.email;

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
          data: { currentQuantity: { decrement: quantityToRemove } },
        });

        await tx.poolMember.delete({ where: { id: memberId } });
        await tx.payment.delete({ where: { id: payment.id } });

        // ✅ Correctly call the hook with the transaction client and poolId
        await updatePoolFinance(tx, poolId);
      });

      console.log(`JOB: Successfully cleaned up and logged deletion for payment ${payment.id}.`);
    } catch (error) {
      console.error(`JOB: Failed to clean up payment ${payment.id}. Error:`, error);
    }
  }
};