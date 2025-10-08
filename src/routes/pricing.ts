import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { calculatePricing, getPricingLogs } from "../controllers/pricingcontroller";
import prisma from "../utils/prismaClient";

// Calculation parameters interface
interface PricingInput {
  basePrice: number;
  distanceKm: number;
  weightKg: number;
  affiliateId?: string;
  userId?: string;
}

export async function calculatePrice({
  basePrice,
  distanceKm,
  weightKg,
  affiliateId,
  userId,
}: PricingInput) {
  // 1️⃣ Basic cost computation
  const distanceFactor = 0.5; // cost per km
  const weightFactor = 0.3;   // cost per kg

  const shippingCost = basePrice + distanceKm * distanceFactor + weightKg * weightFactor;

  // 2️⃣ Optional affiliate commission
  let commission = 0;
  if (affiliateId) {
    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (affiliate) {
      commission = shippingCost * affiliate.commissionRate;
    }
  }

  // 3️⃣ Final total
  const total = shippingCost - commission;

  // 4️⃣ Save log in database
  await prisma.priceCalculationLog.create({
    data: {
      basePrice,
      distanceKm,
      weightKg,
      finalPrice: total,
      userId,
    },
  });

  return {
    basePrice,
    distanceKm,
    weightKg,
    commission,
    total,
  };
}

const router = Router();

// POST /api/pricing/calculate
router.post("/calculate", authenticate, calculatePricing);

// GET /api/pricing/logs
router.get("/logs", authenticate, getPricingLogs);

export default router;
