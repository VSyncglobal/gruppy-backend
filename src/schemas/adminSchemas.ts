// src/schemas/adminSchemas.ts
import { z } from "zod";

// --- REPLACED 'freightRateSchema' with 'logisticsRouteSchema' ---
export const logisticsRouteSchema = z.object({
  body: z.object({
    name: z.string().min(3, { message: "Route name is required" }),
    seaFreightCost: z.coerce.number().nonnegative(),
    originCharges: z.coerce.number().nonnegative(),
    portChargesMombasa: z.coerce.number().nonnegative(),
    clearingAgentFee: z.coerce.number().nonnegative(),
    inlandTransportCost: z.coerce.number().nonnegative(),
    containerDeposit: z.coerce.number().nonnegative(),
    marineInsuranceRate: z.coerce.number().min(0, "Rate must be 0 or positive").max(1, "Rate must be a decimal (e.g., 0.01 for 1%)"),
  }),
});


// For creating/updating KRA tax rates
export const kraRateSchema = z.object({
  body: z.object({
    hsCode: z.string().min(4, { message: "A valid HS Code is required" }),
    duty_rate: z.number().nonnegative(), // --- MODIFIED: Renamed from dutyRate to match schema ---
    rdl_rate: z.number().nonnegative(),  // --- MODIFIED: Renamed from rdlRate to match schema ---
    idf_rate: z.number().nonnegative(),  // --- MODIFIED: Renamed from idfRate to match schema ---
    vat_rate: z.number().nonnegative(),  // --- MODIFIED: Renamed from vatRate to match schema ---
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