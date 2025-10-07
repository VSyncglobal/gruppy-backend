import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

export async function getTaxRates(req: Request, res: Response) {
  const data = await prisma.kRARate.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ success: true, data });
}

export async function createTaxRate(req: Request, res: Response) {
  const { hsCode, taxRate, effectiveFrom, effectiveTo } = req.body;
  const record = await prisma.kRARate.create({
    data: { hsCode, taxRate, effectiveFrom: new Date(effectiveFrom), effectiveTo },
  });
  res.status(201).json({ success: true, record });
}

export async function updateTaxRate(req: Request, res: Response) {
  const { id } = req.params;
  const { hsCode, taxRate, effectiveFrom, effectiveTo } = req.body;
  const updated = await prisma.kRARate.update({
    where: { id },
    data: { hsCode, taxRate, effectiveFrom, effectiveTo },
  });
  res.json({ success: true, updated });
}

export async function deleteTaxRate(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.kRARate.delete({ where: { id } });
  res.json({ success: true });
}
