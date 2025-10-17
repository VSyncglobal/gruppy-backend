import prisma from "../utils/prismaClient";
import { cache } from "../utils/cache";
import logger from "../utils/logger"; // Use the structured logger

interface PricingInput {
  basePrice: number;
  distanceKm: number;
  weightKg: number;
  affiliateId?: string;
  userId?: string;
  hsCode: string; // Made non-optional for clarity
  route: string;  // Made non-optional for clarity
}

export async function calculatePrice(input: PricingInput) {
  const cacheKey = `pricing:${input.basePrice}:${input.distanceKm}:${input.weightKg}:${input.route}:${input.hsCode}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info("💾 Returning cached pricing result");
    return cached;
  }

  // ✨ LOG THE INCOMING REQUEST FOR ANALYTICS
  const pricingRequestLog = await prisma.pricingRequest.create({
      data: {
          userId: input.userId,
          payload: input as any, // Store the raw input payload
      },
  });

  // --- All existing calculation logic remains the same ---

  const freight = await prisma.freightRate.findFirst({
    where: { route: { equals: input.route, mode: "insensitive" } },
  });
  const freightRatePerKg = freight?.ratePerKg || 0;

  const now = new Date();
  const taxRecord = await prisma.kRARate.findFirst({
    where: {
      hsCode: input.hsCode,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: { gte: now } }, { effectiveTo: null }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const duty_rate = taxRecord?.duty_rate || 0;
  const rdl_rate = taxRecord?.rdl_rate || 0;
  const idf_rate = taxRecord?.idf_rate || 0;
  const vat_rate = taxRecord?.vat_rate || 0;

  let commissionRate = 0;
  if (input.affiliateId) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: input.affiliateId },
    });
    commissionRate = affiliate ? affiliate.commissionRate : 0;
  }

  const freightCost = input.weightKg * freightRatePerKg;
  const distanceCost = input.distanceKm * 0.5; // This factor can be configured later
  const subtotal = input.basePrice + freightCost + distanceCost;
  const duty = subtotal * duty_rate;
  const rdl = subtotal * rdl_rate;
  const idf = subtotal * idf_rate;
  const vat = (subtotal + duty + rdl + idf) * vat_rate;
  const totalTaxes = duty + rdl + idf + vat;
  const commission = subtotal * commissionRate;
  const finalPrice = subtotal + totalTaxes - commission;

  // --- End of calculation logic ---

  // Persist the detailed audit log as before
  await prisma.priceCalculationLog.create({
    data: {
      userId: input.userId,
      basePrice: input.basePrice,
      distanceKm: input.distanceKm,
      weightKg: input.weightKg,
      finalPrice,
      route: input.route,
      hsCode: input.hsCode,
      duty_rate,
      rdl_rate,
      idf_rate,
      vat_rate,
      taxesTotal:totalTaxes,
      freightRate: freightRatePerKg,
      commission,
    },
  });

  const result = {
    basePrice: input.basePrice,
    freightRatePerKg,
    duty_rate,
    rdl_rate,
    idf_rate,
    vat_rate,
    commissionRate,
    freightCost,
    distanceCost,
    totalTaxes,
    commission,
    finalPrice,
  };
  
  // ✨ UPDATE THE ANALYTICS LOG WITH THE FINAL RESULT
  await prisma.pricingRequest.update({
      where: { id: pricingRequestLog.id },
      data: { result: result as any },
  });

  await cache.set(cacheKey, result, 3600);
  logger.info("🧮 Cached new pricing result");
  return result;
}

// Keep this export to ensure the file is treated as a module
export {};