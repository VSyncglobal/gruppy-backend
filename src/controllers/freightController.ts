import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// ✅ Create a new freight rate
export async function createFreightRate(req: Request, res: Response) {
  try {
    const { route, ratePerKg } = req.body;

    const freight = await prisma.freightRate.create({
      data: {
        route,
        ratePerKg: Number(ratePerKg),
      },
    });

    res.status(201).json({ success: true, data: freight });
  } catch (error: any) {
    logger.error("Freight creation error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Get all freight rates
export async function getFreightRates(req: Request, res: Response) {
  try {
    const freightRates = await prisma.freightRate.findMany();
    res.json({ success: true, data: freightRates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Update freight rate
export async function updateFreightRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { route, ratePerKg } = req.body;

    const updated = await prisma.freightRate.update({
      where: { id },
      data: { route, ratePerKg: Number(ratePerKg) },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error updating freight rate:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Delete freight rate
export async function deleteFreightRate(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.freightRate.delete({ where: { id } });

    res.json({ success: true, message: "Freight rate deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}
