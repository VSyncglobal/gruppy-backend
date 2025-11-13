// src/controllers/adminPaymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { Prisma, PaymentStatus } from "@prisma/client"; // --- NEW (v_phase6): Import PaymentStatus
import { triggerPoolSettlement } from "../hooks/poolFinanceHooks"; // --- NEW (v_phase6): Import settlement hook

/**
 * --- MODIFIED (v1.3): Get all payments (paginated) with filtering ---
 * (Unchanged)
 */
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // --- NEW (v1.3) Filtering ---
    const { poolId, email, dateFrom, dateTo } = req.query;

    // --- FIX (v1.3): Correctly build nested where clauses ---
    let where: Prisma.PaymentWhereInput = {};
    let poolMemberWhere: Prisma.PoolMemberWhereInput = {};
    let createdAtWhere: Prisma.DateTimeFilter = {};

    if (poolId) {
      poolMemberWhere.poolId = poolId as string;
    }

    if (email) {
      poolMemberWhere.user = {
        email: {
          contains: email as string,
          mode: "insensitive",
        },
      };
    }

    // Only assign poolMemberWhere to where.poolMember if it's not empty
    if (Object.keys(poolMemberWhere).length > 0) {
      where.poolMember = poolMemberWhere;
    }

    if (dateFrom) {
      createdAtWhere.gte = new Date(dateFrom as string);
    }

    if (dateTo) {
      createdAtWhere.lte = new Date(dateTo as string);
    }

    // Only assign createdAtWhere to where.createdAt if it's not empty
    if (Object.keys(createdAtWhere).length > 0) {
      where.createdAt = createdAtWhere;
    }
    // --- End Filtering Fix ---

    const payments = await prisma.payment.findMany({
      where, // Apply filters
      skip,
      take: limit,
      include: {
        poolMember: {
          select: {
            poolId: true,
            userId: true,
            user: { select: { name: true, email: true } },
            pool: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // We get total count *with* the filter applied
    const totalCount = await prisma.payment.count({ where });

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching all payments for admin:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * (Unchanged)
 */
export const getPaymentsForPool = async (req: Request, res: Response) => {
  const { poolId } = req.params;

  try {
    const payments = await prisma.payment.findMany({
      where: {
        poolMember: {
          poolId: poolId,
        },
      },
      include: {
        poolMember: {
          select: {
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    logger.error(`Error fetching payments for pool ${poolId}:`, error);
    Sentry.captureException(error, { extra: { poolId } });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v_phase6) ---
 * Admin: Manually update a payment's status (e.g., force SUCCESS)
 */
export const adminUpdatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id: paymentId } = req.params;
    const { status } = req.body as { status: PaymentStatus };
    const adminUserId = (req as any).user.id;

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    // If payment is already this status, do nothing.
    if (payment.status === status) {
      return res.status(200).json({ success: true, data: payment, message: "Status is already set." });
    }

    // --- CRITICAL LOGIC ---
    // If an admin is forcing a PENDING payment to SUCCESS, we must
    // also trigger the pool settlement logic.
    if (payment.status === PaymentStatus.PENDING && status === PaymentStatus.SUCCESS) {
      
      const updatedPayment = await prisma.$transaction(async (tx) => {
        // 1. Update the payment
        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.SUCCESS,
            metadata: {
              ...((payment.metadata as object) || {}),
              adminOverride: true,
              adminId: adminUserId,
              overrideAt: new Date().toISOString(),
            },
          },
        });

        // 2. Trigger the pool settlement
        await triggerPoolSettlement(tx, updated.poolMemberId);
        return updated;
      });

      logger.info(`Admin ${adminUserId} manually set payment ${paymentId} to SUCCESS. Pool settlement was triggered.`);
      return res.status(200).json({ success: true, data: updatedPayment });

    } else {
      // For all other status changes (e.g., SUCCESS -> FAILED for a refund,
      // or PENDING -> FAILED for a manual cancellation), just update the status.
      // We DO NOT trigger settlement or reverse it, as that is a complex
      // accounting operation (we would need to decrease pool quantity, etc.)
      
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: status,
           metadata: {
              ...((payment.metadata as object) || {}),
              adminOverride: true,
              adminId: adminUserId,
              overrideAt: new Date().toISOString(),
            },
        },
      });

      logger.warn(`Admin ${adminUserId} manually set payment ${paymentId} to ${status}. No settlement was triggered.`);
      return res.status(200).json({ success: true, data: updatedPayment });
    }

  } catch (error: any) {
    logger.error(`Error updating payment status for ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};