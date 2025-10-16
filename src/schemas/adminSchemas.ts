import { z } from "zod";

// For creating/updating freight rates
export const freightRateSchema = z.object({
  body: z.object({
    route: z.string().min(3, { message: "Route name is required" }),
    ratePerKg: z.number().positive({ message: "Rate per Kg must be a positive number" }),
  }),
});

// For creating/updating KRA tax rates
export const kraRateSchema = z.object({
  body: z.object({
    hsCode: z.string().min(4, { message: "A valid HS Code is required" }),
    dutyRate: z.number().nonnegative(),
    rdlRate: z.number().nonnegative(),
    idfRate: z.number().nonnegative(),
    vatRate: z.number().nonnegative(),
    description: z.string().optional(),
    effectiveFrom: z.string().datetime({ message: "Effective date must be a valid ISO date string" }),
  }),
});

// For promoting a user to admin
export const promoteUserSchema = z.object({
    body: z.object({
        userId: z.string().cuid({ message: "A valid userId is required" }),
    })
});

// For creating a new affiliate
export const createAffiliateSchema = z.object({
    body: z.object({
        userId: z.string().cuid({ message: "A valid userId is required" }),
        commissionRate: z.number().positive().optional(),
    })
});