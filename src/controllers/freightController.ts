import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

export async function getFreightRates(req: Request, res: Response) {
  try {
    const rates = await prisma.freightRate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: rates });
  } catch (error) {
    console.error("Error fetching freight rates:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function addFreightRate(req: Request, res: Response) {
  try {
    const { country, ratePerKg } = req.body;

    if (!country || !ratePerKg) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const rate = await prisma.freightRate.create({
      data: {
        route: country, // ✅ schema uses route instead of country
        ratePerKg: Number(ratePerKg),
      },
    });

    res.json({ success: true, data: rate });
  } catch (error) {
    console.error("Error adding freight rate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
