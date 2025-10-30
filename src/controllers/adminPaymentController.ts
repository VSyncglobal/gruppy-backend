// src/controllers/adminPaymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Get all payments (paginated)
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    // Basic pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const payments = await prisma.payment.findMany({
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

    const totalCount = await prisma.payment.count();

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

// Get all payments for a specific pool
export const getPaymentsForPool = async (req: Request, res: Response) => {
  // ✅ FIXED: Moved poolId outside the try block
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
    // ✅ FIXED: poolId is now available in the catch block
    logger.error(`Error fetching payments for pool ${poolId}:`, error);
    Sentry.captureException(error, { extra: { poolId } });
    res.status(500).json({ success: false, message: error.message });
  }
};