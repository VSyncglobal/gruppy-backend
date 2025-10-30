// src/schemas/reviewSchemas.ts
import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5"),
    comment: z.string().optional(),

    // A review must be for EITHER a product OR a pool, but not both.
    productId: z.string().cuid("Invalid product ID").optional(),
    poolId: z.string().cuid("Invalid pool ID").optional(),
  }),
});

export const updateReviewSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid review ID"),
  }),
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5")
      .optional(),
    comment: z.string().optional(),
  }),
});