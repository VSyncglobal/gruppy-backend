// src/schemas/poolSchemas.ts
import { z } from "zod";
// --- MODIFIED: Import PaymentMethod ---
import { PoolStatus, PaymentMethod } from "@prisma/client";

const poolStatusEnum = z.nativeEnum(PoolStatus);

// --- NEW SCHEMA for the Admin Pricing Helper ---
export const calculatePoolPricingSchema = z.object({
  body: z.object({
    productId: z.string().cuid("Invalid product ID"),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID"),
    targetQuantity: z.coerce.number().int().positive("Target quantity must be a positive integer"),
    desiredMinJoiners: z.coerce.number().int().positive("Minimum joiners must be a positive integer"),
    hsCode: z.string().min(4, "HS code is required").optional(),
  }),
});
// --- End new schema ---


export const createPoolSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long"),
    description: z.string().optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
    productId: z.string().cuid("Invalid product ID"),
    
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    targetQuantity: z.coerce.number().int().positive("Target must be positive"),
    minJoiners: z.coerce.number().int().positive("Min joiners must be positive"),
    
    deadline: z.string().datetime("Invalid deadline date"),
    
    baseCostPerUnit: z.coerce.number().positive("Negotiated wholesale cost must be positive"),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID"),
  }),
});

export const updatePoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long").optional(),
    description: z.string().optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
    
    pricePerUnit: z.coerce.number().positive("Price must be positive").optional(),
    targetQuantity: z.coerce.number().int().positive("Target must be positive").optional(),
    minJoiners: z.coerce.number().int().positive("Min joiners must be positive").optional(),
    
    deadline: z.string().datetime("Invalid deadline date").optional(),
  }),
});

// --- THIS SCHEMA IS NOW UPDATED ---
export const joinPoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    
    // --- NEW: User must specify their intended payment method ---
    method: z.nativeEnum(PaymentMethod, {
      message: "A valid payment method (e.g., MPESA) is required.",
    }),
  }),
});
// --- End update ---

export const adminUpdatePoolStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    status: poolStatusEnum,
  }),
});