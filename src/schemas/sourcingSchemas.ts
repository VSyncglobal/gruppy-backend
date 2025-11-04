// src/schemas/sourcingSchemas.ts
import { z } from "zod";
import { SourcingStatus } from "@prisma/client";

// For the simple "Request a Product" button
export const createSourcingRequestSchema = z.object({
  body: z.object({
    productDescription: z.string().min(10, "Please provide a detailed description").max(500),
  }),
});

// For the new "Landed Cost Estimator"
export const estimateLandedCostSchema = z.object({
  body: z.object({
    productDescription: z.string().min(10, "Description is required").max(500),
    basePrice: z.coerce.number().positive("Base price must be a positive number"),
    hsCode: z.string().min(4, "A valid HS code is required"),
  }),
});

// For the admin to update the request with their research
export const updateSourcingRequestSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid request ID"),
  }),
  body: z.object({
    status: z.nativeEnum(SourcingStatus).optional(),
    notes: z.string().optional(),
    hsCode: z.string().min(4).optional(),
    basePrice: z.coerce.number().positive().optional(),
    benchmarkPrice: z.coerce.number().positive().optional(),
  }),
});