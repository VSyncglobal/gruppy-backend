// src/schemas/productSchemas.ts
import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Product name must be at least 3 characters long"),
    hsCode: z.string().min(4, "HS code must be at least 4 characters long"),
    basePrice: z.coerce
      .number()
      .positive("Wholesale price must be a positive number"),
    benchmarkPrice: z.coerce
      .number()
      .positive("Benchmark (individual) price must be a positive number"),
    weightKg: z.coerce.number().positive("Weight in Kg must be a positive number"),
    // --- THIS IS THE FIX ---
    volumeCBM: z.coerce
      .number()
      .positive("Volume in CBM must be a positive number"),
    // --- END OF FIX ---
    defaultRoute: z.string().min(3, "Default route name is required"),
    categoryId: z.string().cuid("A valid category ID is required"),
    subcategoryId: z.string().cuid("A valid subcategory ID is required"),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Product name must be at least 3 characters long")
      .optional(),
    hsCode: z
      .string()
      .min(4, "HS code must be at least 4 characters long")
      .optional(),
    basePrice: z.coerce
      .number()
      .positive("Wholesale price must be a positive number")
      .optional(),
    benchmarkPrice: z.coerce
      .number()
      .positive("Benchmark (individual) price must be a positive number")
      .optional(),
    weightKg: z.coerce
      .number()
      .positive("Weight in Kg must be a positive number")
      .optional(),
    // --- THIS IS THE FIX ---
    volumeCBM: z.coerce
      .number()
      .positive("Volume in CBM must be a positive number")
      .optional(),
    // --- END OF FIX ---
    defaultRoute: z.string().min(3, "Default route name is required").optional(),
    categoryId: z.string().cuid("A valid category ID is required").optional(),
    subcategoryId: z.string().cuid("A valid subcategory ID is required").optional(),
  }),
});