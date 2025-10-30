// src/services/pricingservice.ts
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// ✅ NEW: Add a placeholder exchange rate
// TODO: Replace this with a dynamic value from a live API (e.g., via cache)
const USD_TO_KES_RATE = 130.0;

// ✅ MODIFIED: The function signature now accepts 'currency'
export const calculatePrice = async (input: {
  basePrice: number;
  currency: "USD" | "KES";
  weightKg: number;
  hsCode: string;
  route: string;
  userId?: string;
}) => {
  try {
    // 1. Convert basePrice to KES if necessary
    const basePriceInKES =
      input.currency === "USD"
        ? input.basePrice * USD_TO_KES_RATE
        : input.basePrice;

    // 2. Fetch freight rate
    const freightRate = await prisma.freightRate.findFirst({
      where: { route: input.route },
      orderBy: { createdAt: "desc" },
    });
    if (!freightRate) {
      throw new Error(`Freight rate not found for route: ${input.route}`);
    }
    const freightCost = freightRate.ratePerKg * input.weightKg;

    // 3. Calculate CIF (Cost, Insurance, Freight)
    // Insurance is often a % of (Cost + Freight), e.g., 1.5%.
    // For this calculation, we'll assume basePriceInKES is FOB
    const insurance = (basePriceInKES + freightCost) * 0.015; // 1.5%
    const cif = basePriceInKES + insurance + freightCost;

    // 4. Fetch KRA tax rates
    const kraRate = await prisma.kRARate.findFirst({
      where: { hsCode: input.hsCode },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!kraRate) {
      throw new Error(`KRA rates not found for HS code: ${input.hsCode}`);
    }

    // 5. Calculate taxes based on CIF
    const importDuty = cif * kraRate.duty_rate;
    const idf = cif * kraRate.idf_rate;
    const rdl = cif * kraRate.rdl_rate;
    const vatBase = cif + importDuty + idf + rdl;
    const vat = vatBase * kraRate.vat_rate;
    const taxesTotal = importDuty + idf + rdl + vat;

    // 6. Calculate platform commission
    // Commission on (CIF + Taxes)
    const platformCommission = (cif + taxesTotal) * 0.1; // 10%

    // 7. Calculate final price
    const finalPrice = cif + taxesTotal + platformCommission;

    // 8. Log the calculation (using KES values)
    const logData = {
      basePrice: basePriceInKES, // Store the KES-equivalent price
      weightKg: input.weightKg,
      distanceKm: 0, // 'distanceKm' seems legacy, but we'll keep it
      route: input.route,
      hsCode: input.hsCode,
      freightRate: freightRate.ratePerKg,
      duty_rate: kraRate.duty_rate,
      rdl_rate: kraRate.rdl_rate,
      idf_rate: kraRate.idf_rate,
      vat_rate: kraRate.vat_rate,
      taxesTotal: taxesTotal,
      commission: platformCommission,
      finalPrice: finalPrice,
      userId: input.userId,
    };

    await prisma.priceCalculationLog.create({
      data: logData,
    });

    // 9. Return the detailed breakdown
    return {
      success: true,
      data: {
        basePriceInKES: basePriceInKES,
        cif: cif,
        freightCost: freightCost,
        insurance: insurance,
        taxes: {
          importDuty: importDuty,
          idf: idf,
          rdl: rdl,
          vat: vat,
          total: taxesTotal,
        },
        platformCommission: platformCommission,
        finalPrice: finalPrice,
      },
    };
  } catch (error: any) {
    logger.error("Error in pricing service:", error);
    Sentry.captureException(error, { extra: input });
    return {
      success: false,
      message: error.message || "Error calculating price.",
    };
  }
};