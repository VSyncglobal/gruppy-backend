// src/controllers/deliveryController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * (Unchanged)
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
          message:
            "Delivery is not available for this county, and no default rate is set.",
        });
      }

      const defaultCost =
        defaultRate.baseRate + defaultRate.ratePerKg * weightKg;
      return res.status(200).json({
        success: true,
        data: {
          county: county,
          weightKg: weightKg,
          cost: Math.ceil(defaultCost),
        },
        message: "Using default delivery rate.",
      });
    }

    const cost = rate.baseRate + rate.ratePerKg * weightKg;

    res.status(200).json({
      success: true,
      data: { county: county, weightKg: weightKg, cost: Math.ceil(cost) }, // Round up
    });
  } catch (error: any) {
    logger.error("Error calculating delivery quote:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- NEW (v_phase5): Admin CRUD for Delivery Rates ---

/**
 * Admin: Get all delivery rates
 */
export const getAllDeliveryRates = async (req: Request, res: Response) => {
  try {
    const rates = await prisma.deliveryRate.findMany({
      orderBy: { county: "asc" },
    });
    res.status(200).json({ success: true, data: rates });
  } catch (error: any) {
    logger.error("Error fetching all delivery rates:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Create a new delivery rate
 */
export const createDeliveryRate = async (req: Request, res: Response) => {
  try {
    const { county, baseRate, ratePerKg } = req.body;
    const rate = await prisma.deliveryRate.create({
      data: { county, baseRate, ratePerKg },
    });
    res.status(201).json({ success: true, data: rate });
  } catch (error: any) {
    logger.error("Error creating delivery rate:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("county")) {
      return res.status(409).json({
        success: false,
        message: "A delivery rate for this county already exists.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Update an existing delivery rate
 */
export const updateDeliveryRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { county, baseRate, ratePerKg } = req.body;
    const rate = await prisma.deliveryRate.update({
      where: { id },
      data: { county, baseRate, ratePerKg },
    });
    res.status(200).json({ success: true, data: rate });
  } catch (error: any) {
    logger.error(`Error updating delivery rate ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Delivery rate not found." });
    }
    if (error.code === "P2002" && error.meta?.target?.includes("county")) {
      return res.status(409).json({
        success: false,
        message: "A delivery rate for this county already exists.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Delete a delivery rate
 */
export const deleteDeliveryRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.deliveryRate.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    logger.error(`Error deleting delivery rate ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Delivery rate not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};