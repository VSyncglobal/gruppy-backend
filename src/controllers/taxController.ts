import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

const safeNum = (val: any) => (isNaN(parseFloat(val)) ? 0 : parseFloat(val));

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

export async function addTaxRate(req: Request, res: Response) {
  try {
    const {
      hsCode,
      dutyRate,
      rdlRate,
      idfRate,
      vatRate,
      description,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // ✅ Validate numeric conversion
    const parsedDuty = parseFloat(dutyRate) || 0;
    const parsedRdl = parseFloat(rdlRate) || 0;
    const parsedIdf = parseFloat(idfRate) || 0;
    const parsedVat = parseFloat(vatRate) || 0;

    const rate = await prisma.kRARate.create({
      data: {
        hsCode,
        duty_rate: parsedDuty,
        rdl_rate: parsedRdl,
        idf_rate: parsedIdf,
        vat_rate: parsedVat,
        description,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: rate });
  } catch (error) {
    logger.error("Error adding tax rate:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function updateTaxRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      dutyRate,
      rdlRate,
      idfRate,
      vatRate,
      description,
      effectiveTo,
    } = req.body;

     const updated = await prisma.kRARate.update({
      where: { id },
      data: {
        duty_rate: parseFloat(dutyRate) || 0,
        rdl_rate: parseFloat(rdlRate) || 0,
        idf_rate: parseFloat(idfRate) || 0,
        vat_rate: parseFloat(vatRate) || 0,
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
