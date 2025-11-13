// src/schemas/adminLogisticsSchemas.ts
import { z } from "zod";

// --- Schemas for KenyanTown Management ---

export const createTownSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Town name is required"),
    county: z.string().min(2, "County name is required"),
  }),
});

export const updateTownSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid town ID"),
  }),
  body: z.object({
    name: z.string().min(2, "Town name is required").optional(),
    county: z.string().min(2, "County name is required").optional(),
  }),
});

// --- Schemas for DeliveryRate Management ---

export const createDeliveryRateSchema = z.object({
  body: z.object({
    county: z.string().min(2, "County name is required"),
    baseRate: z.coerce.number().nonnegative("Base rate must be 0 or more"),
    ratePerKg: z.coerce.number().nonnegative("Rate per Kg must be 0 or more"),
  }),
});

export const updateDeliveryRateSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid rate ID"),
  }),
  body: z.object({
    county: z.string().min(2, "County name is required").optional(),
    baseRate: z.coerce.number().nonnegative("Base rate must be 0 or more").optional(),
    ratePerKg: z.coerce.number().nonnegative("Rate per Kg must be 0 or more").optional(),
  }),
});