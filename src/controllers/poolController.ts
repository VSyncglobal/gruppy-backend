// src/controllers/poolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import {
  PoolStatus,
  PaymentStatus,
  Prisma,
  PaymentMethod, // --- NEW (v_phase1) ---
} from "@prisma/client";
import {
  triggerPoolSettlement, // --- NEW (v_phase1) ---
  logFailedJoinAttempt, // --- NEW (v_phase1) ---
} from "../hooks/poolFinanceHooks";
import { initiateSTKPush } from "../services/darajaService"; // --- NEW (v_phase1) ---

// --- UNCHANGED ---
export const getAllPools = async (req: Request, res: Response) => {
  try {
    const { search, category, sort } = req.query;

    let where: Prisma.PoolWhereInput = {
      status: { in: [PoolStatus.FILLING] },
      deadline: { gt: new Date() },
    };

    if (search && typeof search === "string") {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (category && typeof category === "string") {
      if (typeof where.product !== "object" || where.product === null) {
        where.product = {};
      }
      where.product.category = {
        name: { equals: category, mode: "insensitive" },
      };
    }

    let orderBy: Prisma.PoolOrderByWithRelationInput = { deadline: "asc" };
    if (sort === "newest") {
      orderBy = { createdAt: "desc" };
    } else if (sort === "price_asc") {
      orderBy = { pricePerUnit: "asc" };
    } else if (sort === "price_desc") {
      orderBy = { pricePerUnit: "desc" };
    }

    const pools = await prisma.pool.findMany({
      where,
      include: {
        product: true,
        finance: true,
      },
      orderBy,
    });
    res.status(200).json({ success: true, data: pools });
  } catch (error: any) {
    logger.error("Error fetching all pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- UNCHANGED ---
export const getAllPoolsAdmin = async (req: Request, res: Response) => {
  try {
    const pools = await prisma.pool.findMany({
      include: {
        product: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            payments: true, // --- (v_phase1) Show payments for each member
          },
        },
        finance: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({ success: true, data: pools });
  } catch (error: any) {
    logger.error("Error fetching admin pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- MODIFIED (v_phase1): Now only shows *successful* members ---
export const getPoolById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        product: true,
        finance: true,
        members: {
          // By default, this now ONLY includes successful members,
          // because pending/failed attempts are deleted.
          select: {
            userId: true,
            user: { select: { name: true } },
            quantity: true,
          },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }

    // Anonymize member names for public view
    const anonymizedMembers = pool.members.map((member) => {
      const firstName = member.user.name.split(" ")[0];
      const lastNameInitial = member.user.name.split(" ")[1]?.[0] || "";
      return {
        name: `${firstName} ${lastNameInitial}${lastNameInitial ? "." : ""}`,
        quantity: member.quantity,
      };
    });

    const { members, ...poolData } = pool;

    res.status(200).json({
      success: true,
      data: {
        ...poolData,
        members: anonymizedMembers,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching pool by id:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- REWRITTEN (v_phase1): Implements "Atomic Settlement" ---
 * Handles "Delete and Replace" for pending joins and "Split Payment" for balance.
 */
export const joinPool = async (req: Request, res: Response) => {
  const { id: poolId } = req.params;
  const { quantity, method, deliveryFee, phone } = req.body as {
    quantity: number;
    method: PaymentMethod;
    deliveryFee: number;
    phone?: string; // Phone is now required for MPESA
  };
  const userId = (req as any).user.id;

  if (method === PaymentMethod.MPESA && !phone) {
    return res.status(400).json({
      success: false,
      message: "A phone number is required for M-Pesa payments.",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get pool and user data
      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      // 2. Check pool rules
      if (pool.status !== PoolStatus.FILLING) {
        throw new Error("This pool is not open for joining.");
      }
      if (pool.deadline < new Date()) {
        throw new Error("This pool's deadline has passed.");
      }

      // 3. --- "Delete and Replace" Logic ---
      // Find any *existing* join attempts by this user for this pool.
      const existingAttempts = await tx.poolMember.findMany({
        where: { userId, poolId },
        include: { payments: true },
      });

      for (const attempt of existingAttempts) {
        // An attempt is "unsettled" if it has 0 payments or no SUCCESSFUL payments
        const isSettled = attempt.payments.some(
          (p) => p.status === PaymentStatus.SUCCESS
        );

        if (!isSettled) {
          logger.warn(
            `User ${userId} has an unsettled attempt ${attempt.id} for pool ${poolId}. Overriding.`
          );
          // 4. Log the failed attempt for auditing
          await logFailedJoinAttempt(tx, {
            reason: "NEW_JOIN_ATTEMPT_OVERRIDE",
            userId: attempt.userId,
            poolId: attempt.poolId,
            quantity: attempt.quantity,
            payments: attempt.payments,
          });

          // 5. Delete the old PoolMember (this will cascade-delete its payments)
          await tx.poolMember.delete({ where: { id: attempt.id } });
        } else {
          // If they have a *settled* attempt, they can't join again.
          throw new Error("You are already a confirmed member of this pool.");
        }
      }

      // 6. --- "Atomic Settlement" Logic ---
      const totalCost = pool.pricePerUnit * quantity + (deliveryFee || 0);

      // 7. Create the PoolMember *first*
      const poolMember = await tx.poolMember.create({
        data: {
          poolId,
          userId,
          quantity,
        },
      });

      // 8. Calculate payment split
      const amountFromBalance = Math.min(user.accountBalance, totalCost);
      const remainingToPay = totalCost - amountFromBalance;
      let deliveryFeeLogged = false;

      // 9. Create payment record for Account Balance portion (if any)
      if (amountFromBalance > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { accountBalance: { decrement: amountFromBalance } },
        });

        await tx.payment.create({
          data: {
            amount: amountFromBalance,
            method: PaymentMethod.ACCOUNT_BALANCE,
            status: PaymentStatus.SUCCESS,
            poolMemberId: poolMember.id,
            deliveryFee: deliveryFee || 0,
            amountFromBalance: amountFromBalance,
          },
        });
        deliveryFeeLogged = true; // Mark delivery fee as logged
      }

      // 10. Check if further payment is needed
      if (remainingToPay <= 0) {
        // --- CASE A: Fully paid by balance ---
        await triggerPoolSettlement(tx, poolMember.id);
        return {
          status: PaymentStatus.SUCCESS,
          message:
            "Pool joined successfully! Your account balance covered the full cost.",
        };
      } else {
        // --- CASE B: Partial/Full external payment needed ---
        const pendingPayment = await tx.payment.create({
          data: {
            amount: remainingToPay,
            method: method,
            status: PaymentStatus.PENDING,
            poolMemberId: poolMember.id,
            deliveryFee: deliveryFeeLogged ? 0 : deliveryFee || 0, // Log fee only if not already logged
            amountFromBalance: amountFromBalance,
          },
        });

        return {
          status: PaymentStatus.PENDING,
          message: `Pool join initiated. ${
            amountFromBalance > 0
              ? `Used ${amountFromBalance} from balance. `
              : ""
          }Please complete the remaining payment of ${remainingToPay}.`,
          pendingPayment,
        };
      }
    });

    // 11. --- Post-Transaction ---
    if (result.status === PaymentStatus.SUCCESS) {
      // Fully paid by balance
      return res.status(201).json({ success: true, message: result.message });
    } else {
      // Needs external payment
      const { pendingPayment, message } = result;

      if (method === PaymentMethod.MPESA && pendingPayment && phone) {
        // Initiate STK Push
        const stkResponse = await initiateSTKPush(
          pendingPayment.amount,
          phone,
          pendingPayment.id // Use our internal *payment* ID
        );

        // Update payment with the provider's transaction ID
        await prisma.payment.update({
          where: { id: pendingPayment.id },
          data: { providerTransactionId: stkResponse.checkoutRequestID },
        });

        return res.status(200).json({
          success: true,
          message:
            "STK push initiated. Please complete the transaction on your phone.",
          paymentId: pendingPayment.id,
          checkoutRequestID: stkResponse.checkoutRequestID,
        });
      } else {
        // Other payment methods (Stripe, etc.)
        return res.status(201).json({
          success: true,
          message: message,
          data: {
            paymentId: pendingPayment?.id,
            amount: pendingPayment?.amount,
            status: pendingPayment?.status,
          },
        });
      }
    }
  } catch (error: any) {
    logger.error(`Error joining pool ${poolId} for user ${userId}:`, error);
    Sentry.captureException(error, {
      extra: { poolId, userId, quantity, method },
    });
    res
      .status(400)
      .json({ success: false, message: error.message || "Could not join pool." });
  }
};

// --- UNCHANGED ---
// This logic is still sound. It just creates the "plan" for the pool.
export const createPool = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      imageUrls,
      productId,
      pricePerUnit,
      targetQuantity,
      minJoiners,
      deadline,
      totalFixedCosts,
      totalVariableCostPerUnit,
      pricingRequestId,
      debugData,
    } = req.body;

    const createdPool = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
      });

      const pool = await tx.pool.create({
        data: {
          title,
          description,
          imageUrls: imageUrls || [],
          productId,
          pricePerUnit: parseFloat(pricePerUnit),
          targetQuantity: parseInt(targetQuantity, 10),
          minJoiners: parseInt(minJoiners, 10),
          deadline: new Date(deadline),
          createdById: (req as any).user.id,
          status: PoolStatus.FILLING,
          pricingRequestId: pricingRequestId,
        },
      });

      await tx.poolFinance.create({
        data: {
          poolId: pool.id,
          baseCostPerUnit: totalVariableCostPerUnit,
          benchmarkPricePerUnit: product.benchmarkPrice,
          totalFixedCosts: parseFloat(totalFixedCosts),
          totalVariableCostPerUnit: parseFloat(totalVariableCostPerUnit),
          calculationDebugData: debugData || null,
        },
      });

      return pool;
    });

    res.status(201).json({ success: true, data: createdPool });
  } catch (error: any) {
    logger.error("Error creating pool:", error);
    Sentry.captureException(error);
    if (error.name === "NotFoundError" || error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Could not find Product." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- UNCHANGED ---
export const updatePool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      imageUrls,
      pricePerUnit,
      targetQuantity,
      minJoiners,
      deadline,
    } = req.body;

    const pool = await prisma.pool.update({
      where: { id },
      data: {
        title,
        description,
        imageUrls,
        pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : undefined,
        targetQuantity: targetQuantity
          ? parseInt(targetQuantity, 10)
          : undefined,
        minJoiners: minJoiners ? parseInt(minJoiners, 10) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });

    res.status(200).json({ success: true, data: pool });
  } catch (error: any) {
    logger.error("Error updating pool:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Pool or Product not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- REWRITTEN (v_phase1): Uses new schema for safe deletion ---
 * Deletes a pool and all its related, non-audited data.
 */
export const deletePool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      // 1. Clean up related data that does not cascade
      // (Reviews are set to SetNull, but we'll delete them)
      await tx.review.deleteMany({ where: { poolId: id } });
      
      // 2. Find all members of the pool
      const members = await tx.poolMember.findMany({
        where: { poolId: id },
        select: { id: true },
      });
      const memberIds = members.map((m) => m.id);

      if (memberIds.length > 0) {
        // 3. Delete all payments associated with those members
        //    (This is safer than relying on cascade if relation is optional)
        await tx.payment.deleteMany({
          where: { poolMemberId: { in: memberIds } },
        });

        // 4. Delete all members
        await tx.poolMember.deleteMany({
          where: { id: { in: memberIds } },
        });
      }
      
      // 5. Delete associated finance record (onDelete: Cascade *should* handle this, but explicit is safer)
      await tx.poolFinance.delete({ where: { poolId: id } });

      // 6. Delete associated bulk order (if it exists)
      await tx.bulkOrder.delete({ where: { poolId: id } });
      
      // 7. Delete associated failed attempts (if any)
      await tx.failedJoinAttempt.deleteMany({ where: { poolId: id }});

      // 8. Finally, delete the pool itself
      await tx.pool.delete({
        where: { id },
      });
    });

    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting pool:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      // This will catch if the pool, finance, or bulk order doesn't exist
      return res.status(404).json({ success: false, message: "Pool or related data not found" });
    }
    if (error.code === "P2003" || error.code === "P2014") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete pool, it is still linked to other data.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- UNCHANGED ---
export const adminUpdatePoolStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedPool = await prisma.pool.update({
      where: { id },
      data: {
        status: status as PoolStatus,
      },
    });

    if (status === PoolStatus.SHIPPING) {
      logger.info(`Pool ${id} is now SHIPPING.`);
    } else if (status === PoolStatus.DELIVERED) {
      // TODO: Logic for when pool is delivered
    }

    res.status(200).json({ success: true, data: updatedPool });
  } catch (error: any) {
    logger.error("Error updating pool status:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};