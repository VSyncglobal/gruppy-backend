// src/schemas/productSchemas.ts
import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Product name must be at least 3 characters long"),
    hsCode: z.string().min(4, "HS code must be at least 4 characters long"),
    
    // --- MODIFIED & NEW FIELDS ---
    basePrice: z.coerce.number().positive("Wholesale price must be a positive number"),
    benchmarkPrice: z.coerce.number().positive("Benchmark (individual) price must be a positive number"),
    weightKg: z.coerce.number().positive("Weight in Kg must be a positive number"),
    defaultRoute: z.string().min(3, "Default route name is required"),

    // --- MODIFIED: 'subcategoryId' is now required, 'categoryId' is removed (will be auto-detected) ---
    subcategoryId: z.string().cuid("A valid subcategory ID is required"),
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

    // --- MODIFIED & NEW FIELDS ---
    basePrice: z.coerce.number().positive("Wholesale price must be a positive number").optional(),
    benchmarkPrice: z.coerce.number().positive("Benchmark (individual) price must be a positive number").optional(),
    weightKg: z.coerce.number().positive("Weight in Kg must be a positive number").optional(),
    defaultRoute: z.string().min(3, "Default route name is required").optional(),
    
    // --- MODIFIED: 'subcategoryId' can be updated ---
    subcategoryId: z.string().cuid("A valid subcategory ID is required").optional(),
  }),
});