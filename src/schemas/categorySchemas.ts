// src/schemas/categorySchemas.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Category name must be at least 2 characters long"),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid category ID"),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, "Category name must be at least 2 characters long")
      .optional(),
  }),
});

export const createSubcategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Subcategory name must be at least 2 characters long"),
    categoryId: z.string().cuid("Invalid category ID"),
  }),
});

export const updateSubcategorySchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid subcategory ID"),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, "Subcategory name must be at least 2 characters long")
      .optional(),
    categoryId: z.string().cuid("Invalid category ID").optional(),
  }),
});




