// src/controllers/taxController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// No change to this function
export async function getTaxRates(req: Request, res: Response) {
  try {
    const rates = await prisma.kRARate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: rates });
  } catch (error) {
    console.error("Error fetching tax rates:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ✅ --- CORRECTION FOR addTaxRate --- ✅
export async function addTaxRate(req: Request, res: Response) {
  try {
    const {
      hsCode,
      duty_rate, // FIX: Use snake_case
      rdl_rate,  // FIX: Use snake_case
      idf_rate,  // FIX: Use snake_case
      vat_rate,  // FIX: Use snake_case
      description,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // ✅ FIX: The schema already validates these as numbers.
    // We can remove parseFloat completely.
    // The `|| 0` is still good practice.
    const rate = await prisma.kRARate.create({
      data: {
        hsCode,
        duty_rate: duty_rate || 0,
        rdl_rate: rdl_rate || 0,
        idf_rate: idf_rate || 0,
        vat_rate: vat_rate || 0,
        description,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: rate });
  } catch (error) {
    logger.error("Error adding tax rate:", error);
    Sentry.captureException(error);
    // Add a specific check for the unique constraint
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ error: "Unique constraint failed. This HS code and effective date already exist." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ✅ --- CORRECTION FOR updateTaxRate --- ✅
export async function updateTaxRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      duty_rate, // FIX: Use snake_case
      rdl_rate,  // FIX: Use snake_case
      idf_rate,  // FIX: Use snake_case
      vat_rate,  // FIX: Use snake_case
      description,
      effectiveTo,
    } = req.body;

     const updated = await prisma.kRARate.update({
      where: { id },
      data: {
        // FIX: Use the correct variables and fallback to 0
        duty_rate: duty_rate || 0,
        rdl_rate: rdl_rate || 0,
        idf_rate: idf_rate || 0,
        vat_rate: vat_rate || 0,
        description,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error updating tax rate:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
