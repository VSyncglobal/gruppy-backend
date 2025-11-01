// src/services/pricingservice.ts
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// ✅ NEW: Add a placeholder exchange rate
// This is no longer used here but will be used in our new admin controller.
const USD_TO_KES_RATE = 130.0;

// ✅ MODIFIED: This function's logic is now obsolete.
// We are disabling it to prevent the server from crashing.
// The new, correct logic will be in the admin-facing pool calculator.
export const calculatePrice = async (input: {
  basePrice: number;
  currency: "USD" | "KES";
  weightKg: number;
  hsCode: string;
  route: string;
  userId?: string;
}) => {
  
  logger.warn("DEPRECATED: The public 'calculatePrice' service was called.");
  
  return {
    success: false,
    message: "This pricing calculator is disabled. Please use the admin pool creation tool.",
  };
  
  /*
  // --- ALL OF THE OLD, BROKEN LOGIC IS REMOVED ---
  try {
    // 1. Convert basePrice to KES if necessary
    // ...
    // 2. Fetch freight rate
    // const freightRate = await prisma.freightRate.findFirst({ ... }); // <-- THIS IS THE LINE THAT CRASHED
    // ...
  } catch (error: any) {
    // ...
  }
  */
};