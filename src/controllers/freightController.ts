import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

/**
 * @desc Get all freight rates
 * @route GET /api/admin/freight
 */
export async function getFreightRates(req: Request, res: Response) {
  try {
    const data = await prisma.freightRate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching freight rates:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * @desc Create a new freight rate
 * @route POST /api/admin/freight
 */
export async function createFreightRate(req: Request, res: Response) {
  try {
    const { country, ratePerKg } = req.body;

    if (!country || !ratePerKg) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const record = await prisma.freightRate.create({
      data: { country, ratePerKg: Number(ratePerKg) },
    });

    res.status(201).json({ success: true, record });
  } catch (error: any) {
    console.error("Error creating freight rate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * @desc Update an existing freight rate
 * @route PUT /api/admin/freight/:id
 */
export async function updateFreightRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { country, ratePerKg } = req.body;

    const updated = await prisma.freightRate.update({
      where: { id },
      data: {
        ...(country && { country }),
        ...(ratePerKg && { ratePerKg: Number(ratePerKg) }),
      },
    });

    res.json({ success: true, updated });
  } catch (error: any) {
    console.error("Error updating freight rate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * @desc Delete a freight rate
 * @route DELETE /api/admin/freight/:id
 */
export async function deleteFreightRate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.freightRate.delete({ where: { id } });
    res.json({ success: true, message: "Freight rate deleted" });
  } catch (error: any) {
    console.error("Error deleting freight rate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
