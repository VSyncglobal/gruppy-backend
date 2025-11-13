// src/schemas/poolSchemas.ts
import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

// This schema now includes ALL fields from your pool.json
export const createPoolSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title is required"),
    description: z.string().optional(),
    imageUrls: z.array(z.string().url("Invalid URL")).optional(), // Expect an array of strings
    productId: z.string().cuid("A valid product ID is required"),
    pricePerUnit: z.coerce.number().min(1, "Price is required"),
    targetQuantity: z.coerce.number().int().min(1, "Target quantity is required"),
    minJoiners: z.coerce.number().int().min(1, "Min joiners is required"),
    deadline: z.string().datetime("Invalid deadline date"), // Expect ISO string
    // Add hidden fields from simulation
    pricingRequestId: z.string().cuid("Invalid pricing request ID").optional(),
    totalFixedCosts: z.coerce.number().optional(),
    totalVariableCostPerUnit: z.coerce.number().optional(),
    debugData: z.any().optional(),
  }),
});

// For updating a pool
export const updatePoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    title: z.string().min(5, "Title is required").optional(),
    description: z.string().optional(),
    imageUrls: z.array(z.string().url("Invalid URL")).optional(),
    pricePerUnit: z.coerce.number().min(1, "Price is required").optional(),
    targetQuantity: z.coerce
      .number()
      .int()
      .min(1, "Target quantity is required")
      .optional(),
    minJoiners: z.coerce
      .number()
      .int()
      .min(1, "Min joiners is required")
      .optional(),
    deadline: z.string().datetime("Invalid deadline date").optional(),
  }),
});

// For admin updating pool status
export const updatePoolStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "FILLING",
      "CLOSED",
      "SHIPPING",
      "READY_FOR_PICKUP",
      "DELIVERED",
      "CANCELLED",
    ]),
  }),
});

// For a user joining a pool
export const joinPoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    method: z.nativeEnum(PaymentMethod, {
      message: "A valid payment method (e.g., MPESA) is required.",
    }),
    deliveryFee: z.coerce.number().min(0).optional().default(0),
    // --- THIS IS THE FIX ---
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .max(12, "Phone number must be at most 12 digits")
      .optional(),
    // --- END OF FIX ---
  }),
});