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
  } catch (error: any) { // --- FIX: Explicitly type error ---
    console.error("Error fetching tax rates:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function addTaxRate(req: Request, res: Response) {
  try {
    const {
      hsCode,
      duty_rate,
      rdl_rate,
      idf_rate,
      vat_rate,
      description,
      effectiveFrom,
      effectiveTo,
    } = req.body;

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
  } catch (error: any) { // --- FIX: Correctly formed catch block ---
    logger.error("Error adding tax rate:", error);
    Sentry.captureException(error);
    // Add a specific check for the unique constraint
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ error: "Unique constraint failed. This HS code and effective date already exist." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updateTaxRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      duty_rate,
      rdl_rate,
      idf_rate,
      vat_rate,
      description,
      effectiveTo,
    } = req.body;

     const updated = await prisma.kRARate.update({
      where: { id },
      data: {
        duty_rate: duty_rate || 0,
        rdl_rate: rdl_rate || 0,
        idf_rate: idf_rate || 0,
        vat_rate: vat_rate || 0,
        description,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) { // --- FIX: Correctly formed catch block ---
    logger.error("Error updating tax rate:", error);
    Sentry.captureException(error);
    if ((error as any).code === "P2025") {
      return res.status(404).json({ success: false, message: "Tax rate not found" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * --- NEW (v_phase2): Admin: Delete a tax rate ---
 */
export async function deleteTaxRate(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.kRARate.delete({
      where: { id },
    });

    res.status(204).send(); // No Content
  } catch (error: any) { // --- FIX: Correctly formed catch block ---
    logger.error(`Error deleting tax rate ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Tax rate not found" });
    }
    // Handle foreign key constraint (e.g., if a pool calculation depends on this rate)
    if (error.code === "P2003") {
      return res
        .status(409)
        .json({
          success: false,
          message:
            "Cannot delete rate, it is still referenced by other records.",
        });
    }
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}