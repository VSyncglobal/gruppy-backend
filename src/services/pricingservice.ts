import prisma from "../utils/prismaClient";
import { cache } from "../utils/cache";

interface PricingInput {
  basePrice: number;
  distanceKm: number;
  weightKg: number;
  affiliateId?: string;
  userId?: string;
  hsCode?: string;   // for tax calculation
  country?: string;  // for freight rate
}

export async function calculatePrice(input: PricingInput) {
  const cacheKey = `pricing:${input.basePrice}:${input.distanceKm}:${input.weightKg}:${input.country || "none"}:${input.hsCode || "none"}`;
  const cached = await cache.get(cacheKey);

  // 1️⃣ Check cache first
  if (cached) {
    console.log("💾 Returning cached pricing result");
    return cached;
  }

  // 🧭 Debug
  console.log("🔍 Debug input:", input);

  // 2️⃣ Freight rate lookup (simpler, case-insensitive)
  let freightRatePerKg = 0;
  const freightRecord = await prisma.freightRate.findFirst({
    where: {
      country: {
        equals: input.country || "",
        mode: "insensitive",
      },
    },
  });
  console.log("🚚 Freight lookup result:", freightRecord);
  if (freightRecord) freightRatePerKg = freightRecord.ratePerKg;

  // 3️⃣ Tax rate lookup by HS code
  let taxRate = 0;
  const now = new Date();
  const taxRecord = await prisma.kRARate.findFirst({
    where: {
      hsCode: input.hsCode || "",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: { gte: now } }, { effectiveTo: null }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  console.log("💰 Tax lookup result:", taxRecord);
  if (taxRecord) taxRate = taxRecord.taxRate;

  // 4️⃣ Affiliate commission
  let commissionRate = 0;
  if (input.affiliateId) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: input.affiliateId },
    });
    commissionRate = affiliate ? affiliate.commissionRate : 0;
  }

  // 5️⃣ Perform calculation
  const freightCost = input.weightKg * freightRatePerKg;
  const distanceCost = input.distanceKm * 0.5;
  const subtotal = input.basePrice + freightCost + distanceCost;
  const tax = subtotal * taxRate;
  const commission = subtotal * commissionRate;
  const total = subtotal + tax + commission;

  // 6️⃣ Build result
  const result = {
    basePrice: input.basePrice,
    freightRatePerKg,
    taxRate,
    commissionRate,
    freightCost,
    distanceCost,
    tax,
    commission,
    total,
  };

  // 7️⃣ Log to DB
  await prisma.priceCalculationLog.create({
    data: {
      userId: input.userId,
      basePrice: input.basePrice,
      distanceKm: input.distanceKm,
      weightKg: input.weightKg,
      total,
    },
  });

  // 8️⃣ Cache for 1 hour
  await cache.set(cacheKey, result, 3600);
  console.log("🧮 Cached new pricing result");

  return result;
}
