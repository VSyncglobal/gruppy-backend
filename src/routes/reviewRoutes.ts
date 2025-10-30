// src/routes/reviewRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  createReviewSchema,
  updateReviewSchema,
} from "../schemas/reviewSchemas";
// ✅ FIXED: Removed the "ax *" typo
import * as reviewController from "../controllers/reviewController";

const router = Router();

// --- Public Routes ---
// Get reviews for a specific product
router.get("/product/:productId", reviewController.getProductReviews);

// Get reviews for a specific pool
router.get("/pool/:poolId", reviewController.getPoolReviews);

// --- Authenticated User Routes ---
// Create a new review
router.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  reviewController.createReview
);

// Update or Delete your own review
router.put(
  "/:id",
  authenticate,
  validate(updateReviewSchema),
  reviewController.updateReview
);
router.delete("/:id", authenticate, reviewController.deleteReview);

// --- Admin-Only Routes ---
// Get all reviews (for admin dashboard)
router.get("/all", authenticate, requireAdmin, reviewController.getAllReviews);

export default router;