import { z } from "zod";

export const calculatePriceSchema = z.object({
  body: z.object({
    basePrice: z.number().positive({ message: "basePrice must be a positive number" }),
    distanceKm: z.number().nonnegative({ message: "distanceKm must be a non-negative number" }),
    weightKg: z.number().nonnegative({ message: "weightKg must be a non-negative number" }),
    hsCode: z.string().min(1, { message: "hsCode is required" }),
    route: z.string().min(1, { message: "route is required" }),
    affiliateId: z.string().optional(),
  }),
});