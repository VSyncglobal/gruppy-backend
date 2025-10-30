// src/schemas/pricingSchemas.ts
import { z } from "zod";

export const calculatePriceSchema = z.object({
  body: z.object({
    basePrice: z.coerce.number().positive("Base price must be a positive number"),
    
    // ✅ FIXED: Used the correct 'message' property for the error.
    currency: z.enum(["USD", "KES"], {
      message: "Currency must be either 'USD' or 'KES'",
    }),
    
    weightKg: z.coerce.number().positive("Weight must be a positive number"),
    hsCode: z.string().min(4, "HS code is required"),
    route: z.string().min(3, "Route is required"),
  }),
});