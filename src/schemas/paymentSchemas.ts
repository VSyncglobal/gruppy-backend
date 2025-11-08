// src/schemas/paymentSchemas.ts
import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const createPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().cuid("Invalid payment record ID"),
    phone: z
      .string()
      .min(10, "A valid phone number is required (e.g., 2547XXXXXXXX)")
      .max(12),
    method: z.nativeEnum(PaymentMethod, {
      // --- THIS IS THE FIX ---
      // Replaced 'errorMap' with the 'message' property
      message: "Invalid payment method",
      // --- END OF FIX ---
    }),
  }),
});