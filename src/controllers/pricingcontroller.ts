import { Response } from "express";
import { calculatePrice } from "../services/pricingservice";
import prisma from "../utils/prismaClient";
import { AuthRequest } from "../middleware/auth";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export async function calculatePricing(req: AuthRequest, res: Response) {
  try {
    const { basePrice, distanceKm, weightKg, affiliateId, hsCode, route } = req.body;

    const result = await calculatePrice({
      basePrice: Number(basePrice),
      distanceKm: Number(distanceKm),
      weightKg: Number(weightKg),
      affiliateId,
      hsCode,
      route,
      userId: req.user?.id,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Pricing calculation failed:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}



// ... (getPricingLogs function remains the same)

// ... the rest of your file (getPricingLogs function) remains the same
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
        where: { userId: user.id },// ✅ use user.id, not user.userId
        orderBy: { createdAt: "desc" },
      });
    }

    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error("Error fetching pricing logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
