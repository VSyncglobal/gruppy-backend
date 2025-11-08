// src/schemas/deliverySchemas.ts
import { z } from "zod";

export const getDeliveryQuoteSchema = z.object({
  body: z.object({
    county: z.string().min(1, "County is required"),
    weightKg: z.number().min(0, "Weight must be a positive number"),
  }),
});