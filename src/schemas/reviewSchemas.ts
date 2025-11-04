// src/schemas/reviewSchemas.ts
import { z } from "zod";

// This is for creating a NEW, top-level review
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

// This is for UPDATING an existing review
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

// --- ✅ NEW SCHEMA ---
// This is for replying to an existing review
export const replyToReviewSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid parent review ID"), // The ID of the review we are replying to
  }),
  body: z.object({
    comment: z.string().min(1, "Reply comment cannot be empty"),
  }),
});