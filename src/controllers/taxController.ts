import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

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

    const rate = await prisma.kRARate.create({
      data: {
        hsCode,
        duty_rate: Number(dutyRate),
        rdl_rate: Number(rdlRate),
        idf_rate: Number(idfRate),
        vat_rate: Number(vatRate),
        description,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: rate });
  } catch (error) {
    console.error("Error adding tax rate:", error);
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
        duty_rate: Number(dutyRate),
        rdl_rate: Number(rdlRate),
        idf_rate: Number(idfRate),
        vat_rate: Number(vatRate),
        description,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating tax rate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
