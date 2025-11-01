// src/schemas/paymentSchemas.ts
import { z } from "zod";
// --- NEW: Import the enum from the Prisma client ---
import { PaymentMethod } from "@prisma/client";

export const initiatePaymentSchema = z.object({
  body: z.object({
    // --- MODIFIED: Renamed from poolMemberId to paymentId ---
    // This aligns with our finalized flow (join pool -> get paymentId -> initiate)
    paymentId: z.string().cuid({ message: "A valid paymentId is required" }),
    
    // --- MODIFIED: Now validates against the enum ---
    method: z.nativeEnum(PaymentMethod, {
      message: "Invalid payment method. Must be MPESA, STRIPE, or AIRTEL_MONEY",
    }),

    // --- NEW: This field will be required for the STK push ---
    phone: z.string().min(10, "A valid phone number is required"),
  }),
});