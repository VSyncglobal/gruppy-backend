// src/schemas/productSchemas.ts
import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Product name must be at least 3 characters long"),
    hsCode: z.string().min(4, "HS code must be at least 4 characters long"),
    basePrice: z.number().positive("Base price must be a positive number"),
    
    // ✅ NEWLY ADDED
    categoryId: z.string().cuid("Invalid category ID").optional(),
    subcategoryId: z.string().cuid("Invalid subcategory ID").optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid product ID"),
  }),
  body: z.object({
    name: z
      .string()
      .min(3, "Product name must be at least 3 characters long")
      .optional(),
    hsCode: z
      .string()
      .min(4, "HS code must be at least 4 characters long")
      .optional(),
    basePrice: z.number().positive("Base price must be a positive number").optional(),

    // ✅ NEWLY ADDED
    categoryId: z.string().cuid("Invalid category ID").nullish(), // .nullish() allows unsetting it
    subcategoryId: z.string().cuid("Invalid subcategory ID").nullish(),
  }),
});