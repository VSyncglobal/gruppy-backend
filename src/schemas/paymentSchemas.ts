// src/schemas/paymentSchemas.ts
import { z } from "zod";
import { PaymentMethod, PaymentStatus } from "@prisma/client"; // --- NEW (v_phase6): Import PaymentStatus

export const createPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().cuid("Invalid payment record ID"),
    phone: z
      .string()
      .min(10, "A valid phone number is required (e.g., 2547XXXXXXXX)")
      .max(12),
    method: z.nativeEnum(PaymentMethod, {
      message: "Invalid payment method",
    }),
  }),
});

// --- NEW (v_phase6): Schema for admin to manually update a payment status ---
export const adminUpdatePaymentStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid payment ID"),
  }),
  body: z.object({
    status: z.nativeEnum(PaymentStatus, {
      message: "Invalid payment status (PENDING, SUCCESS, FAILED)",
    }),
  }),
});