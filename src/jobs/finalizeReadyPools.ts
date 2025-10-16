import prisma from "../utils/prismaClient";
import { OrderStatus, PoolStatus } from "@prisma/client";

const generateOrderNumber = (poolId: string) => `GRP-POOL-${poolId.slice(-6).toUpperCase()}`;

export const finalizeReadyPools = async () => {
  console.log("JOB: Running finalizer for ready pools...");

  // 1. Find all pools that are either FILLED or are READY_TO_SHIP and past their deadline
  const now = new Date();
  const poolsToFinalize = await prisma.pool.findMany({
    where: {
      OR: [
        { status: PoolStatus.FILLED },
        { status: PoolStatus.READY_TO_SHIP, deadline: { lte: now } },
      ],
    },
  });

  if (poolsToFinalize.length === 0) {
    console.log("JOB: No pools are ready for finalization.");
    return;
  }

  console.log(`JOB: Found ${poolsToFinalize.length} pools to finalize.`);

  // 2. Process each pool
  for (const pool of poolsToFinalize) {
    try {
      // 3. Use a transaction to ensure all or nothing
      await prisma.$transaction(async (tx) => {
        // Step A: Lock the pool by changing its status
        await tx.pool.update({
          where: { id: pool.id },
          data: { status: PoolStatus.CLOSED },
        });

        // Step B: Create the master order for the entire pool
        const masterOrder = await tx.order.create({
          data: {
            order_number: generateOrderNumber(pool.id),
            userId: pool.createdById, // The pool creator is the owner of the master order
            productId: pool.productId,
            status: OrderStatus.SOURCING,
            final_price_ksh: pool.pricePerUnit * pool.currentQuantity, // Total value of the order
          },
        });

        // Step C: Create the initial audit trail for the new order
        await tx.orderStatusHistory.create({
          data: {
            orderId: masterOrder.id,
            fromStatus: OrderStatus.SOURCING, // Conceptual start
            toStatus: OrderStatus.SOURCING,
            note: `Master order created from finalized Pool ID: ${pool.id}`,
          },
        });

        console.log(`JOB: Successfully finalized Pool ${pool.id} and created Master Order ${masterOrder.order_number}.`);
      });

      // Step D: Simulate notification
      console.log(`SIMULATION: Notification sent to admin for new Master Order for Pool ${pool.id}.`);

    } catch (error) {
      console.error(`JOB: Failed to finalize pool ${pool.id}. Error:`, error);
    }
  }
};