import prisma from "../utils/prismaClient";
import { cache } from "../utils/cache";

interface PricingInput {
  basePrice: number;
  distanceKm: number;
  weightKg: number;
  affiliateId?: string;
  userId?: string;
  hsCode?: string;   // for tax calculation
  route?: string;    // for freight lookup
}

export async function calculatePrice(input: PricingInput) {
  // ✅ Build cache key
  const cacheKey = `pricing:${input.basePrice}:${input.distanceKm}:${input.weightKg}:${input.route || "none"}:${input.hsCode || "none"}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.log("💾 Returning cached pricing result");
    return cached;
  }

  // ✅ Freight Rate Lookup
  let freightRatePerKg = 0;
  if (input.route) {
    const freight = await prisma.freightRate.findFirst({
      where: {
        route: { equals: input.route, mode: "insensitive" },
      },
    });
    if (freight) freightRatePerKg = freight.ratePerKg;
  }

  // ✅ Tax Lookup (KRA)
  let duty_rate = 0, rdl_rate = 0, idf_rate = 0, vat_rate = 0;
  if (input.hsCode) {
    const now = new Date();
    const taxRecord = await prisma.kRARate.findFirst({
      where: {
        hsCode: input.hsCode,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: { gte: now } }, { effectiveTo: null }],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (taxRecord) {
      duty_rate = taxRecord.duty_rate || 0;
      rdl_rate = taxRecord.rdl_rate || 0;
      idf_rate = taxRecord.idf_rate || 0;
      vat_rate = taxRecord.vat_rate || 0;
    }
  }

  // ✅ Commission Lookup (Affiliate)
  let commissionRate = 0;
  if (input.affiliateId) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: input.affiliateId },
    });
    commissionRate = affiliate ? affiliate.commissionRate : 0;
  }

  // ✅ Base Calculations
  const freightCost = input.weightKg * freightRatePerKg;
  const distanceCost = input.distanceKm * 0.5;
  const subtotal = input.basePrice + freightCost + distanceCost;

  // ✅ Taxes Sequentially
  const duty = subtotal * duty_rate;
  const rdl = subtotal * rdl_rate;
  const idf = subtotal * idf_rate;
  const vat = (subtotal + duty + rdl + idf) * vat_rate;
  const totalTaxes = duty + rdl + idf + vat;

  // ✅ Commission & Final
  const commission = subtotal * commissionRate;
  const finalPrice = subtotal + totalTaxes - commission;

  // ✅ Persist Log
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
      taxesTotal: totalTaxes,   // ✅ FIXED NAME
      freightRate: freightRatePerKg,
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

  await cache.set(cacheKey, result, 3600);
  console.log("🧮 Cached new pricing result");
  return result;
}

export {}; // ✅ Marks file as a module
