// src/schemas/poolSchemas.ts
import { z } from "zod";
import { PoolStatus } from "@prisma/client";

const poolStatusEnum = z.nativeEnum(PoolStatus);

export const createPoolSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long"),
    description: z.string().optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
    productId: z.string().cuid("Invalid product ID"),
    
    // ✅ FIXED: Simplified all number coercions
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    targetQuantity: z.coerce.number().int().positive("Target must be positive"),
    minJoiners: z.coerce.number().int().positive("Min joiners must be positive"),
    
    deadline: z.string().datetime("Invalid deadline date"),
    
    baseCostPerUnit: z.coerce.number().positive("Base cost must be positive"),
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
    productId: z.string().cuid("Invalid product ID").optional(),
    
    // ✅ FIXED: Simplified all number coercions
    pricePerUnit: z.coerce.number().positive("Price must be positive").optional(),
    targetQuantity: z.coerce.number().int().positive("Target must be positive").optional(),
    minJoiners: z.coerce.number().int().positive("Min joiners must be positive").optional(),
    
    deadline: z.string().datetime("Invalid deadline date").optional(),
  }),
});

export const joinPoolSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    paymentId: z.string().cuid("Invalid payment ID"),
  }),
});

export const adminUpdatePoolStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid pool ID"),
  }),
  body: z.object({
    status: poolStatusEnum,
  }),
});