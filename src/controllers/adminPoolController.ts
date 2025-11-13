// src/controllers/adminPoolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { GlobalSetting, Product, LogisticsRoute, KRARate } from "@prisma/client";

/**
 * --- MODIFIED (v_phase2): Uses new margin keys ---
 * A helper function to convert the GlobalSetting array into a usable object
 */
const getSettings = (
  settings: GlobalSetting[],
  overridePlatformMargin?: number
) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    USD_TO_KES_RATE: settingsMap.get("USD_TO_KES_RATE") || 130.0,
    // Use new, clearer margin keys
    RISK_MARGIN: settingsMap.get("RISK_MARGIN") || 0.02,
    PLATFORM_MARGIN:
      overridePlatformMargin || settingsMap.get("PLATFORM_MARGIN") || 0.05,
  };
};

/**
 * --- REWRITTEN (v_phase2): Implements new, simpler profit model ---
 * This is the core engine.
 */
async function runPoolCalculation(
  product: Product,
  logisticsRoute: LogisticsRoute,
  kraRate: KRARate,
  globalSettings: GlobalSetting[],
  targetQuantity: number,
  baseCostPerUnit: number,
  overridePlatformMargin?: number
) {
  // 1. Get business rules
  const settings = getSettings(globalSettings, overridePlatformMargin);

  // 2. Calculate "Per-Item" C, I, and F
  const costC = baseCostPerUnit;
  const costI = costC * logisticsRoute.marineInsuranceRate;

  const poolTotalVolume = product.volumeCBM * targetQuantity;
  const poolTotalWeight = product.weightKg * targetQuantity;
  const utilisationCBM = poolTotalVolume / logisticsRoute.capacityCBM;
  const utilisationWeight = poolTotalWeight / logisticsRoute.capacityKg;
  const dominantFraction = Math.max(utilisationCBM, utilisationWeight);

  if (dominantFraction > 1.0) {
    throw new Error(
      `Target quantity (${targetQuantity}) exceeds container capacity by ${Math.round(
        (dominantFraction - 1) * 100
      )}%`
    );
  }

  const totalContainerFixedCosts =
    logisticsRoute.seaFreightCost +
    logisticsRoute.originCharges +
    logisticsRoute.portChargesMombasa +
    logisticsRoute.clearingAgentFee +
    logisticsRoute.inlandTransportCost -
    logisticsRoute.containerDeposit;

  const poolTotalFixedCost = totalContainerFixedCosts * dominantFraction; // This is F (Total Fixed Cost)
  const costF = poolTotalFixedCost / targetQuantity || 0; // This is F (Per-Item Fixed Cost)

  // 3. Calculate the Correct CIF Value
  const cifValue = costC + costI + costF;

  // 4. Calculate Taxes (Based on Correct CIF)
  const importDuty = cifValue * kraRate.duty_rate;
  const idf = cifValue * kraRate.idf_rate;
  const rdl = cifValue * kraRate.rdl_rate;
  const vatBase = cifValue + importDuty + idf + rdl;
  const vat = vatBase * kraRate.vat_rate;
  const totalTaxes = importDuty + idf + rdl + vat;

  // 5. Calculate Final "True Landed Cost" (This is your TrueTotalCost per item)
  const trueLandedCost = cifValue + totalTaxes; // This is (CostV + CostF)

  // 6. --- NEW (v_phase2): Apply Margins using new, simpler formula ---
  const finalSellingPrice =
    trueLandedCost / (1 - settings.PLATFORM_MARGIN - settings.RISK_MARGIN); // P

  // --- Round values for calculation ---
  const P_rounded = Math.ceil(finalSellingPrice);
  const V_Cost_rounded = parseFloat(trueLandedCost.toFixed(2));
  const F_rounded = parseFloat(poolTotalFixedCost.toFixed(2)); // Total Fixed Cost

  // 7. --- NEW (v_phase2): Calculate minJoiners (Break-Even) using new formula ---
  let suggestedMinJoiners: number | string;

  // EarningPerUnit is the total margin (profit + risk) baked into the price
  const earningPerUnit =
    P_rounded * (settings.PLATFORM_MARGIN + settings.RISK_MARGIN);

  if (earningPerUnit < 0.01) {
    suggestedMinJoiners = "Not Profitable";
  } else {
    // Break-Even = Total Fixed Costs / Total Earning Per Unit
    const breakEven = F_rounded / earningPerUnit;
    suggestedMinJoiners = Math.ceil(breakEven);
  }

  // 8. Viability Check & Creative Suggestion
  const isViable = P_rounded < product.benchmarkPrice;
  const benchmarkDifference = product.benchmarkPrice - P_rounded;

  let suggestion: string;
  if (isViable) {
    suggestion = `Price (${P_rounded}) is ${benchmarkDifference} KES BELOW benchmark (${product.benchmarkPrice}). This is a viable pool.`;
  } else {
    suggestion = `Price (${P_rounded}) is ${Math.abs(
      benchmarkDifference
    )} KES ABOVE benchmark (${product.benchmarkPrice}). Pool is not viable.`;
  }
  // --- END FIX ---

  // 9. Return the structured result
  return {
    baseCostPerUnit: baseCostPerUnit,
    targetQuantity: targetQuantity,
    platformMargin: settings.PLATFORM_MARGIN, // --- (v_phase2) Renamed
    riskMargin: settings.RISK_MARGIN, // --- (v_phase2) New
    viability: isViable ? "PASS" : "FAIL",
    proposedPricePerUnit: P_rounded,
    suggestedMinJoiners: suggestedMinJoiners,
    benchmarkPrice: product.benchmarkPrice,
    suggestion: suggestion,
    costsForPoolCreation: {
      totalFixedCosts: F_rounded,
      totalVariableCostPerUnit: V_Cost_rounded, // --- (v_phase2) Renamed
    },
    debug: {
      dominantFraction: dominantFraction,
      earningPerUnit: earningPerUnit, // --- (v_phase2) Renamed
      cifValue: cifValue,
      totalTaxes: totalTaxes,
      trueLandedCost: trueLandedCost,
    },
  };
}

/**
 * --- MODIFIED (v_phase2): Fetches new GlobalSetting keys ---
 * This is the "single run" calculator.
 */
export const calculatePoolPricing = async (req: Request, res: Response) => {
  const {
    productId,
    logisticsRouteId,
    targetQuantity,
    baseCostPerUnit,
    hsCode,
  } = req.body;

  try {
    const [product, logisticsRoute, kraRate, globalSettings] =
      await prisma.$transaction([
        prisma.product.findUniqueOrThrow({ where: { id: productId } }),
        prisma.logisticsRoute.findUniqueOrThrow({
          where: { id: logisticsRouteId },
        }),
        prisma.kRARate.findFirstOrThrow({
          where: {
            hsCode: {
              startsWith:
                hsCode ||
                (
                  await prisma.product.findUniqueOrThrow({
                    where: { id: productId },
                  })
                ).hsCode,
            },
          },
          orderBy: { effectiveFrom: "desc" },
        }),
        prisma.globalSetting.findMany({
          // --- MODIFIED (v_phase2): Fetches new margin keys ---
          where: {
            key: {
              in: ["RISK_MARGIN", "PLATFORM_MARGIN", "USD_TO_KES_RATE"],
            },
          },
        }),
      ]);

    const result = await runPoolCalculation(
      product,
      logisticsRoute,
      kraRate,
      globalSettings,
      targetQuantity,
      baseCostPerUnit
      // No margin override
    );

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Error in calculatePoolPricing:", error);
    Sentry.captureException(error);
    if (error.name === "NotFoundError" || error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message:
          "Could not find a required resource (Product, Route, or KRA Rate).",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- MODIFIED (v_phase2): REMOVED ALL DATABASE LOGGING ---
 * This is the "parallel simulation" endpoint.
 * It no longer logs to the database.
 */
export const runPoolSimulations = async (req: Request, res: Response) => {
  const {
    productId,
    logisticsRouteId,
    baseCostPerUnit,
    hsCode,
    targetQuantity,
    platformMargin // This param is now overridePlatformMargin
  } = req.body;

  const MAX_SIMULATION_RUNS = 1000;
  const MAX_VIABLE_TO_STORE = 10;
  const MAX_FAILED_TO_STORE = 5;

  try {
    const [product, logisticsRoute, kraRate, globalSettings] =
      await prisma.$transaction([
        prisma.product.findUniqueOrThrow({ where: { id: productId } }),
        prisma.logisticsRoute.findUniqueOrThrow({
          where: { id: logisticsRouteId },
        }),
        prisma.kRARate.findFirstOrThrow({
          where: {
            hsCode: {
              startsWith:
                hsCode ||
                (
                  await prisma.product.findUniqueOrThrow({
                    where: { id: productId },
                  })
                ).hsCode,
            },
          },
          orderBy: { effectiveFrom: "desc" },
        }),
        prisma.globalSetting.findMany({
          // --- MODIFIED (v_phase2): Fetches new margin keys ---
          where: {
            key: {
              in: ["RISK_MARGIN", "PLATFORM_MARGIN", "USD_TO_KES_RATE"],
            },
          },
        }),
      ]);

    const qRange = targetQuantity || [100, 100, 1];
    // --- MODIFIED (v_phase2): Uses new margin keys ---
    const feeRange = platformMargin || [
      getSettings(globalSettings).PLATFORM_MARGIN,
      getSettings(globalSettings).PLATFORM_MARGIN,
      0.01, // Default step of 1%
    ];
    const costRange = Array.isArray(baseCostPerUnit)
      ? baseCostPerUnit
      : [baseCostPerUnit, baseCostPerUnit, 1];

    let topViableResults: any[] = [];
    let closestFailedResults: any[] = [];
    let runCount = 0;
    let errorCount = 0;
    let warning: string | null = null;

    Loop: for (let cost = costRange[0]; cost <= costRange[1]; cost += costRange[2]) {
      for (let q = qRange[0]; q <= qRange[1]; q += qRange[2]) {
        // Handle floating point precision issues with margins
        const feeStart = Math.round(feeRange[0] * 100);
        const feeEnd = Math.round(feeRange[1] * 100);
        const feeStep = Math.round(feeRange[2] * 100) || 1; // Ensure step is at least 1

        for (let feeNum = feeStart; feeNum <= feeEnd; feeNum += feeStep) {
          const fee = feeNum / 100; // The overridePlatformMargin

          if (runCount >= MAX_SIMULATION_RUNS) {
            warning = `Simulation limit of ${MAX_SIMULATION_RUNS} runs reached. Results may be partial.`;
            break Loop;
          }
          runCount++;

          try {
            const result = await runPoolCalculation(
              product,
              logisticsRoute,
              kraRate,
              globalSettings,
              q,
              cost,
              fee // Pass the fee as the override
            );

            if (result.viability === "PASS") {
              topViableResults.push(result);
              topViableResults.sort(
                (a, b) => a.proposedPricePerUnit - b.proposedPricePerUnit
              );
              if (topViableResults.length > MAX_VIABLE_TO_STORE) {
                topViableResults.pop();
              }
            } else {
              const missDistance =
                result.proposedPricePerUnit - result.benchmarkPrice;
              (result as any).missDistance = missDistance;
              closestFailedResults.push(result);
              closestFailedResults.sort((a, b) => a.missDistance - b.missDistance);
              if (closestFailedResults.length > MAX_FAILED_TO_STORE) {
                closestFailedResults.pop();
              }
            }
          } catch (error: any) {
            errorCount++;
          }
        }
      }
    }

    const finalResults = {
      runCount: runCount,
      errorCount: errorCount,
      warning: warning,
      optimalConfiguration: topViableResults[0] || null,
      topViableResults: topViableResults,
      closestFailedResults: closestFailedResults,
    };

    // --- DELETED (v_phase2): Removed the prisma.pricingRequest.create() call ---
    // The calculator no longer logs to the DB.

    // 5. Return the streamlined results
    res.status(200).json({
      success: true,
      data: finalResults,
    });
  } catch (error: any) {
    logger.error("Error in runPoolSimulations:", error);
    Sentry.captureException(error);
    if (error.name === "NotFoundError" || error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message:
          "Could not find a required resource (Product, Route, or KRA Rate).",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};