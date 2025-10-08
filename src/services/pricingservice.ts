// src/services/pricingService.ts
import prisma from "../utils/prismaClient";
import { cache } from "../utils/cache";

export interface PricingInput {
  basePrice: number;       // product cost (CIF base component)
  distanceKm: number;
  weightKg: number;
  affiliateId?: string | null;
  userId?: string | null;
  hsCode?: string | null;
  route?: string | null;   // route e.g. "China-Mombasa Sea"
  insurancePercent?: number; // optional insurance percent (e.g., 0.01 for 1%)
  handlingFee?: number;      // flat handling fee in USD
  marginPercent?: number;    // profit margin e.g., 0.10 for 10%
}

export interface PricingResult {
  basePrice: number;
  route?: string | null;
  hsCode?: string | null;
  freightRatePerKg: number;
  freightCost: number;
  distanceCost: number;
  insuranceAmount: number;
  CIF: number;
  duty_rate: number;
  dutyAmount: number;
  rdl_rate: number;
  rdlAmount: number;
  idf_rate: number;
  idfAmount: number;
  vat_rate: number;
  vatAmount: number;
  taxesTotal: number;
  handlingFee: number;
  landedCost: number;
  marginPercent: number;
  marginAmount: number;
  commissionRate: number;
  commissionAmount: number;
  finalPrice: number;
}

export async function calculatePrice(input: PricingInput): Promise<PricingResult> {
  const cacheKey = `pricing:${input.basePrice}:${input.weightKg}:${input.distanceKm}:${input.route ?? 'none'}:${input.hsCode ?? 'none'}:${input.marginPercent ?? 0}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.log("💾 Returning cached pricing result");
    return cached;
  }

  // defaults
  const insurancePercent = typeof input.insurancePercent === 'number' ? input.insurancePercent : 0; // e.g., 0.01
  const handlingFee = typeof input.handlingFee === 'number' ? input.handlingFee : 0;
  const marginPercent = typeof input.marginPercent === 'number' ? input.marginPercent : (Number(process.env.DEFAULT_MARGIN_PERCENT) || 0.1);

  // 1) Freight rate lookup (by route)
  let freightRatePerKg = 0;
  let freightRecord = null;
  if (input.route) {
    freightRecord = await prisma.freightRate.findFirst({
      where: { route: { equals: input.route, mode: "insensitive" } },
    });
    if (freightRecord) freightRatePerKg = Number(freightRecord.ratePerKg);
  }

  // 2) Tax lookup (KRARate) - choose latest effective rate for hsCode
  let duty_rate = 0, rdl_rate = 0, idf_rate = 0, vat_rate = 0;
  let taxRecord = null;
  if (input.hsCode) {
    const now = new Date();
    taxRecord = await prisma.kRARate.findFirst({
      where: {
        hsCode: input.hsCode,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: { gte: now } }, { effectiveTo: null }],
      },
      orderBy: { effectiveFrom: 'desc' }
    });
    if (taxRecord) {
      duty_rate = Number(taxRecord.duty_rate || 0);
      rdl_rate = Number(taxRecord.rdl_rate || 0);
      idf_rate = Number(taxRecord.idf_rate || 0);
      vat_rate = Number(taxRecord.vat_rate || 0);
    }
  }

  // 3) Affiliate commission rate
  let commissionRate = 0;
  if (input.affiliateId) {
    const affiliate = await prisma.affiliate.findUnique({ where: { id: input.affiliateId } });
    if (affiliate) commissionRate = Number(affiliate.commissionRate || 0);
  }

  // 4) Costs calculation
  const freightCost = Number(input.weightKg) * freightRatePerKg;
  const distanceCost = Number(input.distanceKm) * (Number(process.env.DISTANCE_RATE_PER_KM) || 0.5);
  const insuranceAmount = (input.basePrice + freightCost + distanceCost) * insurancePercent;
  const CIF = Number(input.basePrice) + freightCost + distanceCost + insuranceAmount;

  // Sequential taxes applied per blueprint
  const dutyAmount = CIF * duty_rate;
  const rdlAmount = CIF * rdl_rate;
  const idfAmount = CIF * idf_rate;

  const vatBase = CIF + dutyAmount + rdlAmount + idfAmount;
  const vatAmount = vatBase * vat_rate;

  const taxesTotal = dutyAmount + rdlAmount + idfAmount + vatAmount;

  const landedCost = CIF + taxesTotal + handlingFee;

  // margin and commission
  const marginAmount = landedCost * marginPercent;
  const commissionAmount = landedCost * commissionRate;

  // Final price — depending on business rule, commission could be deducted or paid separately.
  // We'll produce finalPrice = landedCost + marginAmount  (commission recorded separately)
  const finalPrice = landedCost + marginAmount;

  const result: PricingResult = {
    basePrice: input.basePrice,
    route: input.route ?? null,
    hsCode: input.hsCode ?? null,
    freightRatePerKg,
    freightCost,
    distanceCost,
    insuranceAmount,
    CIF,
    duty_rate,
    dutyAmount,
    rdl_rate,
    rdlAmount,
    idf_rate,
    idfAmount,
    vat_rate,
    vatAmount,
    taxesTotal,
    handlingFee,
    landedCost,
    marginPercent,
    marginAmount,
    commissionRate,
    commissionAmount,
    finalPrice,
  };

  // 5) Save detailed log to DB (snapshot)
  await prisma.priceCalculationLog.create({
    data: {
      userId: input.userId ?? null,
      basePrice: input.basePrice,
      distanceKm: input.distanceKm,
      weightKg: input.weightKg,
      route: input.route ?? null,
      hsCode: input.hsCode ?? null,
      freightRate: freightRatePerKg || null,
      duty_rate: duty_rate || null,
      rdl_rate: rdl_rate || null,
      idf_rate: idf_rate || null,
      vat_rate: vat_rate || null,
      taxesTotal: taxesTotal || 0,
      commission: commissionAmount || 0,
      finalPrice,
    }
  });

  // 6) Cache result for 1 hour
  await cache.set(cacheKey, result, 3600);

  return result;
}
