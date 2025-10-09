
// src/controllers/pricingcontroller.ts

import { Request, Response } from "express";
import { calculatePrice } from "../services/pricingservice";
import prisma from "../utils/prismaClient";
import { AuthRequest } from "../middleware/auth";

// ========================
// 1️⃣ PRICE CALCULATION (FIXED)
// ========================
export async function calculatePricing(req: AuthRequest, res: Response) {
  try {
    // ✅ FIX: Added hsCode and route to be extracted from the body
    const { basePrice, distanceKm, weightKg, affiliateId, hsCode, route } = req.body;

    if (!basePrice || !distanceKm || !weightKg || !hsCode || !route) {
      return res.status(400).json({ error: "Missing required fields: basePrice, distanceKm, weightKg, hsCode, and route are all required." });
    }

    const result = await calculatePrice({
      basePrice: Number(basePrice),
      distanceKm: Number(distanceKm),
      weightKg: Number(weightKg),
      affiliateId,
      hsCode, // ✅ FIX: Pass hsCode to the service
      route,   // ✅ FIX: Pass route to the service
      userId: req.user?.userId, // ✅ FIX: Correctly access userId from token
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Pricing calculation failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

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
