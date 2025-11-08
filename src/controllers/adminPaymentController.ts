// src/controllers/adminPaymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // --- CORRECT SENTRY IMPORT ---
import { Prisma } from "@prisma/client";

/**
 * --- MODIFIED (v1.3): Get all payments (paginated) with filtering ---
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

// This function remains unchanged
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