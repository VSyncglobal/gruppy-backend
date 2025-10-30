// src/controllers/pricingcontroller.ts
import { Request, Response } from "express";
import { calculatePrice } from "../services/pricingservice";
import prisma from "../utils/prismaClient"; // Keep prisma import for getPricingLogs
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // ✅ FIXED typo

export const calculatePriceHandler = async (req: Request, res: Response) => {
  try {
    // ✅ MODIFIED: Removed 'distanceKm', added 'currency'
    const { basePrice, currency, weightKg, hsCode, route } = req.body;
    const userId = (req as any).user?.id; // Get user ID if logged in

    const result = await calculatePrice({
      basePrice: parseFloat(basePrice),
      currency, // ✅ Pass 'currency'
      weightKg: parseFloat(weightKg),
      hsCode,
      route,
      userId,
      // ✅ 'distanceKm' is now correctly removed
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error: any) {
    logger.error("Error in pricing controller:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// This function remains unchanged
export const getPricingLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.priceCalculationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to last 50
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    logger.error("Error fetching pricing logs:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};