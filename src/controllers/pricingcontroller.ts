import { Request, Response } from "express";
import { calculatePrice } from "../services/pricingservice"; // ⚠️ check spelling (capital S)
import prisma from "../utils/prismaClient";
import { AuthRequest } from "../middleware/auth";

// ========================
// 1️⃣ PRICE CALCULATION
// ========================
export async function calculatePricing(req: Request, res: Response) {
  try {
    const { basePrice, distanceKm, weightKg, affiliateId } = req.body;

    if (!basePrice || !distanceKm || !weightKg) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await calculatePrice({
      basePrice: Number(basePrice),
      distanceKm: Number(distanceKm),
      weightKg: Number(weightKg),
      affiliateId,
      userId: (req as any).user?.id, // ✅ capture from token
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Pricing calculation failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ========================
// 2️⃣ FETCH PRICING LOGS
// ========================
export async function getPricingLogs(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let logs;

    if (user.role === "ADMIN") {
      // ✅ Admins can view all calculation logs
      logs = await prisma.priceCalculationLog.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, role: true } },
        },
      });
    } else {
      // ✅ Regular users see only their own logs
      logs = await prisma.priceCalculationLog.findMany({
        where: { userId: user.userId }, // ✅ use user.id, not user.userId
        orderBy: { createdAt: "desc" },
      });
    }

    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error("Error fetching pricing logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
