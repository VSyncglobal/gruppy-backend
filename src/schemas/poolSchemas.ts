// src/schemas/poolSchemas.ts
import { z } from "zod";
import { PoolStatus, PaymentMethod } from "@prisma/client";

const poolStatusEnum = z.nativeEnum(PoolStatus);

// --- UNCHANGED (v2.1 Engine) ---
export const calculatePoolPricingSchema = z.object({
  body: z.object({
    productId: z.string().cuid("Invalid product ID"),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID"),
    targetQuantity: z.coerce.number().int().positive("Target quantity must be a positive integer"),
    baseCostPerUnit: z.coerce.number().positive("Base cost must be a positive number"),
    hsCode: z.string().min(4, "HS code is required").optional(),
  }),
});

// --- UNCHANGED (v2.1 Engine) ---
export const runSimulationSchema = z.object({
  body: z.object({
    productId: z.string().cuid("Invalid product ID"),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID"),
    hsCode: z.string().min(4, "HS code is required").optional(),
    baseCostPerUnit: z.union([
        z.coerce.number().positive("Base cost must be a positive number"),
        z.tuple([
          z.coerce.number().positive(),
          z.coerce.number().positive(),
          z.coerce.number().positive(),
        ])
    ]),
    targetQuantity: z.tuple([
      z.coerce.number().int().positive(),
      z.coerce.number().int().positive(),
      z.coerce.number().int().positive(),
    ]).optional(),
    platformFeeRate: z.tuple([
      z.coerce.number().min(0),
      z.coerce.number().min(0),
      z.coerce.number().positive(),
    ]).optional(),
  }),
});


export const createPoolSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long"),
    description: z.string().optional(),
    imageUrls: z
      .array(z.string().url("Each image must be a valid URL"))
      .max(5, "You can upload a maximum of 5 images")
      .optional(),
    productId: z.string().cuid("Invalid product ID"),
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    targetQuantity: z.coerce.number().int().positive("Target must be positive"),
    minJoiners: z.coerce.number().int().positive("Min joiners is required and must be positive"),
    deadline: z.string().datetime("Invalid deadline date"),
    totalFixedCosts: z.coerce.number().min(0, "Total fixed costs is required"),
    totalVariableCostPerUnit: z.coerce.number().positive("Total variable cost is required"),
    pricingRequestId: z.string().cuid("Invalid pricing request ID").optional(),

    // --- NEW (v2.9 Logging) ---
    // This will accept the 'debug' object from the simulation
    debugData: z.object({}).passthrough().optional(),
    // --- END NEW ---
  }),
});

//

export const updatePoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long").optional(),
    description: z.string().optional(),
    imageUrls: z
      .array(z.string().url("Each image must be a valid URL"))
      .max(5, "You can upload a maximum of 5 images")
      .optional(),
    pricePerUnit: z.coerce.number().positive("Price must be positive").optional(),
    targetQuantity: z.coerce.number().int().positive("Target must be positive").optional(),
    minJoiners: z.coerce.number().int().positive("Min joiners must be positive").optional(),
    deadline: z.string().datetime("Invalid deadline date").optional(),
  }),
});

// src/schemas/poolSchemas.ts
// ... (keep other schemas) ...

// --- MODIFIED (v1.3) ---
export const joinPoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    method: z.nativeEnum(PaymentMethod, {
      message: "A valid payment method (e.g., MPESA) is required.",
    }),
    deliveryFee: z.coerce.number().min(0).optional().default(0), // <-- ADDED
  }),
});

// ... (keep other schemas) ...

export const adminUpdatePoolStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    status: poolStatusEnum,
  }),
});