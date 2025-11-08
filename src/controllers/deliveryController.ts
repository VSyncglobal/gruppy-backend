// src/controllers/deliveryController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // --- CORRECTED SENTRY IMPORT ---

/**
 * Calculates a delivery quote based on county and weight.
 */
export const getDeliveryQuote = async (req: Request, res: Response) => {
  try {
    const { county, weightKg } = req.body;

    const rate = await prisma.deliveryRate.findUnique({
      where: { county: county },
    });

    if (!rate) {
      logger.warn(`Delivery quote requested for unconfigured county: ${county}`);
      // Fallback to a default rate if no specific county rate is found
      const defaultRate = await prisma.deliveryRate.findUnique({
        where: { county: "Default" }, // You should create a "Default" entry in your table
      });

      if (!defaultRate) {
        return res.status(404).json({ 
          success: false, 
          message: "Delivery is not available for this county, and no default rate is set." 
        });
      }
      
      const defaultCost = defaultRate.baseRate + (defaultRate.ratePerKg * weightKg);
      return res.status(200).json({ 
        success: true, 
        data: { county: county, weightKg: weightKg, cost: Math.ceil(defaultCost) },
        message: "Using default delivery rate."
      });
    }

    const cost = rate.baseRate + (rate.ratePerKg * weightKg);

    res.status(200).json({ 
      success: true, 
      data: { county: county, weightKg: weightKg, cost: Math.ceil(cost) } // Round up
    });

  } catch (error: any) {
    logger.error("Error calculating delivery quote:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};