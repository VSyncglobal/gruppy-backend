// src/controllers/adminPoolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { GlobalSetting, Product, LogisticsRoute, KRARate } from "@prisma/client";

// --- (Helper functions: getSettings, runPoolCalculation - unchanged from previous correct version) ---
const getSettings = (
  settings: GlobalSetting[],
  overridePlatformMargin?: number
) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    USD_TO_KES_RATE: settingsMap.get("USD_TO_KES_RATE") || 130.0,
    RISK_MARGIN: settingsMap.get("RISK_MARGIN") || 0.02,
    PLATFORM_MARGIN:
      overridePlatformMargin || settingsMap.get("PLATFORM_MARGIN") || 0.05,
  };
};

async function runPoolCalculation(
  product: Product,
  logisticsRoute: LogisticsRoute,
  kraRate: KRARate,
  globalSettings: GlobalSetting[],
  targetQuantity: number,
  baseCostPerUnit: number,
  overridePlatformMargin?: number
) {
  const settings = getSettings(globalSettings, overridePlatformMargin);
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

  const poolTotalFixedCost = totalContainerFixedCosts * dominantFraction;
  const costF = poolTotalFixedCost / targetQuantity || 0;
  const cifValue = costC + costI + costF;
  const importDuty = cifValue * kraRate.duty_rate;
  const idf = cifValue * kraRate.idf_rate;
  const rdl = cifValue * kraRate.rdl_rate;
  const vatBase = cifValue + importDuty + idf + rdl;
  const vat = vatBase * kraRate.vat_rate;
  const totalTaxes = importDuty + idf + rdl + vat;
  const trueLandedCost = cifValue + totalTaxes;
  const finalSellingPrice =
    trueLandedCost / (1 - settings.PLATFORM_MARGIN - settings.RISK_MARGIN);
  const P_rounded = Math.ceil(finalSellingPrice);
  const V_Cost_rounded = parseFloat(trueLandedCost.toFixed(2));
  const F_rounded = parseFloat(poolTotalFixedCost.toFixed(2));
  let suggestedMinJoiners: number | string;
  const earningPerUnit =
    P_rounded * (settings.PLATFORM_MARGIN + settings.RISK_MARGIN);

  if (earningPerUnit < 0.01) {
    suggestedMinJoiners = "Not Profitable";
  } else {
    const breakEven = F_rounded / earningPerUnit;
    suggestedMinJoiners = Math.ceil(breakEven);
  }

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

  return {
    baseCostPerUnit: baseCostPerUnit,
    targetQuantity: targetQuantity,
    platformMargin: settings.PLATFORM_MARGIN,
    riskMargin: settings.RISK_MARGIN,
    viability: isViable ? "PASS" : "FAIL",
    proposedPricePerUnit: P_rounded,
    suggestedMinJoiners: suggestedMinJoiners,
    benchmarkPrice: product.benchmarkPrice,
    suggestion: suggestion,
    costsForPoolCreation: {
      totalFixedCosts: F_rounded,
      totalVariableCostPerUnit: V_Cost_rounded,
    },
    debug: {
      dominantFraction: dominantFraction,
      earningPerUnit: earningPerUnit,
      cifValue: cifValue,
      totalTaxes: totalTaxes,
      trueLandedCost: trueLandedCost,
    },
  };
}

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
 * --- RECTIFIED: This version logs the request and returns the ID ---
 */
export const runPoolSimulations = async (req: Request, res: Response) => {
  const {
    productId,
    logisticsRouteId,
    baseCostPerUnit,
    hsCode,
    targetQuantity,
    platformMargin, // --- FIX: Use correct key 'platformMargin' ---
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
          where: {
            key: {
              in: ["RISK_MARGIN", "PLATFORM_MARGIN", "USD_TO_KES_RATE"],
            },
          },
        }),
      ]);

    const qRange = targetQuantity || [100, 100, 1];
    const feeRange = platformMargin || [ // --- FIX: Use correct key 'platformMargin' ---
      getSettings(globalSettings).PLATFORM_MARGIN,
      getSettings(globalSettings).PLATFORM_MARGIN,
      0.01,
    ];
    const costRange = Array.isArray(baseCostPerUnit)
      ? baseCostPerUnit
      : [baseCostPerUnit, baseCostPerUnit, 1];

    let topViableResults: any[] = [];
    let closestFailedResults: any[] = [];
    let runCount = 0;
    let errorCount = 0;
    let warning: string | null = null;

    // --- (Loop logic is unchanged) ---
    Loop: for (let cost = costRange[0]; cost <= costRange[1]; cost += costRange[2]) {
      for (let q = qRange[0]; q <= qRange[1]; q += qRange[2]) {
        const feeStart = Math.round(feeRange[0] * 100);
        const feeEnd = Math.round(feeRange[1] * 100);
        const feeStep = Math.round(feeRange[2] * 100) || 1;

        for (let feeNum = feeStart; feeNum <= feeEnd; feeNum += feeStep) {
          const fee = feeNum / 100;

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
              fee
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

    // --- THIS IS THE CORRECT LOGIC (as per your request) ---
    // 1. Log the simulation input and output
    const log = await prisma.pricingRequest.create({
      data: {
        userId: (req as any).user.id,
        payload: req.body as any, // This logs the input
        result: finalResults as any, // This logs the full output
      },
    });
    // --- END OF CORRECT LOGIC ---

    // 2. Return the results AND the log ID
    res.status(200).json({
      success: true,
      pricingRequestId: log.id, // <-- Return the ID
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