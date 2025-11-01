// src/controllers/adminPoolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { GlobalSetting } from "@prisma/client";

/**
 * A helper function to convert the GlobalSetting array into a usable object
 */
const getSettings = (settings: GlobalSetting[]) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    USD_TO_KES_RATE: settingsMap.get("USD_TO_KES_RATE") || 130.0,
    CONTINGENCY_FEE_RATE: settingsMap.get("CONTINGENCY_FEE_RATE") || 0.02,
    PLATFORM_FEE_RATE: settingsMap.get("PLATFORM_FEE_RATE") || 0.05,
  };
};

/**
 * Admin: Calculates a proposed selling price and break-even point for a new pool.
 * This is a non-destructive helper endpoint.
 */
export const calculatePoolPricing = async (req: Request, res: Response) => {
  const {
    productId,
    logisticsRouteId,
    targetQuantity,
    desiredMinJoiners,
  } = req.body;

  try {
    // 1. Fetch all required data in a single transaction
    const [product, logisticsRoute, kraRate, globalSettings] = await prisma.$transaction([
      prisma.product.findUniqueOrThrow({
        where: { id: productId },
      }),
      prisma.logisticsRoute.findUniqueOrThrow({
        where: { id: logisticsRouteId },
      }),
      prisma.kRARate.findFirstOrThrow({
        where: { hsCode: { startsWith: req.body.hsCode || (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).hsCode } },
        orderBy: { effectiveFrom: "desc" },
      }),
      prisma.globalSetting.findMany({
        where: { key: { in: ["CONTINGENCY_FEE_RATE", "PLATFORM_FEE_RATE"] } },
      }),
    ]);

    // 2. Get business rules from settings
    const settings = getSettings(globalSettings);

    // 3. Calculate Total Fixed Costs
    const totalFixedCosts =
      logisticsRoute.seaFreightCost +
      logisticsRoute.originCharges +
      logisticsRoute.portChargesMombasa +
      logisticsRoute.clearingAgentFee +
      logisticsRoute.inlandTransportCost -
      logisticsRoute.containerDeposit;
    
    // 4. Calculate Total Variable Cost Per Unit (Wholesale Price + Insurance + Taxes)
    const cost = product.basePrice; // e.g., 10,000 KES
    const insurance = cost * logisticsRoute.marineInsuranceRate;
    const cif_per_unit = cost + insurance; // Note: Freight is a fixed cost, not added here

    // Calculate KRA taxes based on the *per-unit* CIF
    const importDuty = cif_per_unit * kraRate.duty_rate;
    const idf = cif_per_unit * kraRate.idf_rate;
    const rdl = cif_per_unit * kraRate.rdl_rate;
    const vatBase = cif_per_unit + importDuty + idf + rdl;
    const vat = vatBase * kraRate.vat_rate;
    const taxes_per_unit = importDuty + idf + rdl + vat;
    
    const totalVariableCostPerUnit = product.basePrice + taxes_per_unit + insurance;

    // 5. Add Contingency (Your 2% rule)
    const totalFixedCostWithContingency = totalFixedCosts * (1 + settings.CONTINGENCY_FEE_RATE);
    const totalVariableCostWithContingency = totalVariableCostPerUnit * (1 + settings.CONTINGENCY_FEE_RATE);

    // 6. Find Break-Even Cost at `desiredMinJoiners`
    const totalCostAtBreakEven = 
      totalFixedCostWithContingency + 
      (totalVariableCostWithContingency * desiredMinJoiners);
    
    const breakEvenPricePerUnit = totalCostAtBreakEven / desiredMinJoiners;

    // 7. Propose Final Selling Price (Adding platform profit)
    const proposedPricePerUnit = breakEvenPricePerUnit / (1 - settings.PLATFORM_FEE_RATE);

    // 8. Calculate Total Potential Profit
    const totalCostAtTarget = 
      totalFixedCostWithContingency +
      (totalVariableCostWithContingency * targetQuantity);
    
    const totalRevenueAtTarget = proposedPricePerUnit * targetQuantity;
    const totalProfitAtTarget = totalRevenueAtTarget - totalCostAtTarget;

    // 9. Return the detailed proposal
    res.status(200).json({
      success: true,
      data: {
        proposedPricePerUnit: Math.ceil(proposedPricePerUnit), // Round up to nearest KES
        minJoiners: desiredMinJoiners,
        breakEvenPrice: Math.ceil(breakEvenPricePerUnit),
        benchmarkPrice: product.benchmarkPrice, // The "AliExpress" price
        targetQuantity: targetQuantity,
        totalProfitAtTarget: Math.floor(totalProfitAtTarget), // Round down
        
        // --- Debug Info ---
        costs: {
          totalFixedCostWithContingency: Math.ceil(totalFixedCostWithContingency),
          totalVariableCostWithContingency: Math.ceil(totalVariableCostWithContingency),
          taxes_per_unit: Math.ceil(taxes_per_unit),
          platformFeeRate: settings.PLATFORM_FEE_RATE,
          contingencyRate: settings.CONTINGENCY_FEE_RATE,
        }
      },
    });

  } catch (error: any) {
    logger.error("Error in calculatePoolPricing:", error);
    Sentry.captureException(error);
    if (error.name === 'NotFoundError') {
      return res.status(404).json({ success: false, message: "Could not find a required resource (Product, Route, or KRA Rate)." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};